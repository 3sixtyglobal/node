// Copyright 2025 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Converter } from "@twin.org/core";
import { Blake2b } from "@twin.org/crypto";
import {
	DataspaceProtocolCatalogTypes,
	type IDataspaceProtocolCatalog,
	type IDataspaceProtocolDatasetBase
} from "@twin.org/standards-dataspace-protocol";
import { assert, assertEquals } from "../assert.js";
import type { IKenyaContext } from "../context.js";
import { fail, info, ok, phase, step } from "../logger.js";
import { makeAuthenticationClient, makeFederatedCatalogueClient } from "../restClientFactory.js";

// docker-compose.yml lives in the sibling kenyaCommunityNodeDocker folder.
// `docker compose restart` needs to run from there to find the service def.
const SCAFFOLD_DIR = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
	"..",
	"..",
	"kenyaCommunityNodeDocker"
);

/**
 * Run a command via child_process and capture stdout. Mirrors `bash -c …` for
 * the small number of docker calls Phase 10 needs.
 * @param command The command to run.
 * @param args The command arguments.
 * @param cwd The working directory to run the command in.
 * @returns The stdout / exit code pair.
 */
async function run(
	command: string,
	args: string[],
	cwd?: string
): Promise<{ stdout: string; code: number }> {
	return new Promise(resolve => {
		const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"], cwd });
		const stdoutChunks: Buffer[] = [];
		child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
		child.stderr.on("data", (chunk: Buffer) => {
			process.stderr.write(chunk);
		});
		child.on("close", code => {
			resolve({ stdout: Buffer.concat(stdoutChunks).toString("utf8"), code: code ?? -1 });
		});
	});
}

/**
 * Walk every dataset entry across the top-level Catalog and any nested
 * sub-catalogs (mirrors Phase 3's traversal — duplicated here intentionally to
 * keep Phase 10 self-contained when reading the test).
 * @param catalog The catalogue response.
 * @returns A flat list of datasets.
 */
function flattenDatasets(catalog: IDataspaceProtocolCatalog): IDataspaceProtocolDatasetBase[] {
	const out: IDataspaceProtocolDatasetBase[] = [];
	const topDatasets = catalog.dataset;
	if (Array.isArray(topDatasets)) {
		out.push(...topDatasets);
	} else if (topDatasets) {
		out.push(topDatasets);
	}
	const sub = catalog.catalog;
	const subList = Array.isArray(sub) ? sub : [];
	if (sub && !Array.isArray(sub)) {
		subList.push(sub);
	}
	for (const c of subList) {
		const d = c.dataset;
		if (Array.isArray(d)) {
			out.push(...d);
		} else if (d) {
			out.push(d);
		}
	}
	return out;
}

/**
 * Phase 10 — restart the container and verify that the S4 composite publisher
 * fallback fires on boot republish. populateDefaults runs in a no-user
 * (no Organization) context on boot, so for stored datasets the publisher is
 * stamped from the `nodeId:tenantId` composite. This phase reads nodeId out
 * of `engine-state.json` inside the running container, restarts, re-logs in,
 * and asserts the stored dataset's `dct:publisher` matches the expected
 * composite string.
 * @param context The scenario context. Session JWT is refreshed in place.
 */
export async function runPhase10(context: IKenyaContext): Promise<void> {
	phase(10, "S4 — composite publisher fallback on boot republish (no-user context)");

	step("Reading expected nodeId from container engine-state.json + tenantId from .tenants");
	const dockerCat = await run("docker", [
		"exec",
		"twin-kenya-node",
		"sh",
		"-c",
		"cat /app/data/engine-state.json"
	]);
	assertEquals(dockerCat.code, 0, "docker exec cat engine-state.json exit code");
	let nodeDid = "";
	try {
		nodeDid = (JSON.parse(dockerCat.stdout) as { nodeId?: string }).nodeId ?? "";
	} catch {
		fail(`Could not parse engine-state.json: ${dockerCat.stdout}`);
	}
	assert(nodeDid.length > 0, `Node DID resolved (${nodeDid})`, "engine-state.json had no nodeId");
	// Path B: composite carries the BLAKE2b-256 hash (base64url) of the tenantId,
	// not the plaintext. Compute the expected hash to match what the service
	// stamps as `dcterms:publisher` during boot republish.
	const tenantHash = Converter.bytesToBase64Url(
		Blake2b.sum256(Converter.utf8ToBytes(context.kraTenantId))
	);
	const expectedComposite = `${nodeDid}:${tenantHash}`;
	info(`Expected composite publisher: ${expectedComposite}`);

	step("Restarting node container to trigger boot republish");
	const restart = await run("docker", ["compose", "restart", "twin-kenya-node"], SCAFFOLD_DIR);
	assertEquals(restart.code, 0, "docker compose restart exit code");

	// Wait for the engine to finish populating the catalogue. The bash script
	// uses a 12-second hard sleep; mirror it.
	await new Promise(resolve => setTimeout(resolve, 12000));

	step("Re-logging in as KRA after restart (sessions are in-memory, restart invalidates)");
	const auth = makeAuthenticationClient(context.host, context.kraApiKey);
	const login = await auth.login(context.kraUserEmail, context.kraUserPassword);
	assert(
		typeof login.token === "string" && login.token.length > 0,
		"KRA re-logged in after restart",
		"KRA re-login after restart failed"
	);
	context.kraSessionJwt = login.token ?? "";

	step("Querying catalogue + decoding dcterms:publisher");
	const catalogue = makeFederatedCatalogueClient({
		host: context.host,
		apiKey: context.kraApiKey,
		sessionJwt: context.kraSessionJwt
	});
	const { result } = await catalogue.query([], undefined, undefined, undefined);
	if (result["@type"] !== DataspaceProtocolCatalogTypes.Catalog) {
		fail(`Unexpected catalogue response @type=${String(result["@type"])}`);
	}

	const datasets = flattenDatasets(result);
	const dataset = datasets.find(d => d["@id"] === context.kraDatasetId);
	if (!dataset) {
		fail(`Dataset ${context.kraDatasetId} missing from catalogue after restart`);
	}
	const ds = dataset as unknown as { [key: string]: unknown };
	const actualPublisher =
		(typeof ds["dct:publisher"] === "string" && ds["dct:publisher"]) ||
		(typeof ds["dcterms:publisher"] === "string" && ds["dcterms:publisher"]) ||
		"";

	info(`Actual publisher: ${actualPublisher}`);
	assertEquals(
		actualPublisher,
		expectedComposite,
		"S4 composite-fallback fired correctly (publisher = nodeId:tenantId composite)"
	);
	ok("S4 composite-fallback fired correctly");
}
