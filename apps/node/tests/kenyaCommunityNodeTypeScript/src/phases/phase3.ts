// Copyright 2025 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import {
	DataspaceProtocolCatalogTypes,
	type IDataspaceProtocolCatalog,
	type IDataspaceProtocolDatasetBase
} from "@twin.org/standards-dataspace-protocol";
import { assert, assertNonEmpty } from "../assert.js";
import type { IKenyaContext } from "../context.js";
import { fail, info, ok, phase } from "../logger.js";
import { makeFederatedCatalogueClient } from "../restClientFactory.js";

/**
 * Walk every dataset entry across the top-level Catalog and any nested
 * sub-catalogs. After S1 (2026-05-19) distinct per-tenant DIDs cause the
 * federated catalogue to nest datasets under a per-publisher sub-catalog
 * (DCAT-AP correct behaviour). The traversal here mirrors the bash test's
 * `(.dataset[]?, .catalog[]?.dataset[]?)` jq expression.
 * @param catalog The catalogue response object.
 * @returns A flat list of every dataset encountered.
 */
function flattenDatasets(catalog: IDataspaceProtocolCatalog): IDataspaceProtocolDatasetBase[] {
	const out: IDataspaceProtocolDatasetBase[] = [];
	const topDatasets = catalog.dataset;
	if (Array.isArray(topDatasets)) {
		out.push(...topDatasets);
	} else if (topDatasets) {
		out.push(topDatasets);
	}

	const subCatalogs = catalog.catalog;
	const subList = Array.isArray(subCatalogs) ? subCatalogs : [];
	if (subCatalogs && !Array.isArray(subCatalogs)) {
		subList.push(subCatalogs);
	}
	for (const sub of subList) {
		const subDatasets = sub.dataset;
		if (Array.isArray(subDatasets)) {
			out.push(...subDatasets);
		} else if (subDatasets) {
			out.push(subDatasets);
		}
	}
	return out;
}

/**
 * Resolve the accessService URL for a dataset's first distribution. The
 * catalogue may return distributions as either `distribution` or
 * `dcat:distribution`, and either as an array or a single object — we mirror
 * the bash scaffold's tolerant probing.
 * @param dataset The dataset to inspect.
 * @returns The accessService URL or undefined when none could be located.
 */
function extractAccessServiceUrl(dataset: IDataspaceProtocolDatasetBase): string | undefined {
	const distribution =
		(dataset as unknown as { [key: string]: unknown }).distribution ??
		(dataset as unknown as { [key: string]: unknown })["dcat:distribution"];
	if (!distribution) {
		return undefined;
	}
	const first = Array.isArray(distribution) ? distribution[0] : distribution;
	if (!first || typeof first !== "object") {
		return undefined;
	}
	const access = (first as { [key: string]: unknown }).accessService;
	if (typeof access === "string") {
		return access;
	}
	if (access && typeof access === "object") {
		const endpoint = (access as { [key: string]: unknown }).endpointURL;
		if (typeof endpoint === "string") {
			return endpoint;
		}
	}
	return undefined;
}

/**
 * Pull the `x-enc-tenant-token` query parameter from a URL. Returns undefined
 * when the URL is malformed or the parameter is absent.
 * @param url The URL to parse.
 * @returns The encrypted tenant token, if present.
 */
function extractEncTenantToken(url: string): string | undefined {
	try {
		return new URL(url).searchParams.get("x-enc-tenant-token") ?? undefined;
	} catch {
		// Fall back to a regex for non-absolute URLs.
		const match = /[&?]x-enc-tenant-token=([^&]+)/.exec(url);
		return match ? decodeURIComponent(match[1]) : undefined;
	}
}

/**
 * Phase 3 — Trader sees KRA's dataset in the catalogue and the
 * distribution.accessService URL carries the encrypted publisher tenant
 * token (TICKET-G).
 * @param context The scenario context. Populates `kraTenantToken` for
 * downstream phases.
 */
export async function runPhase3(context: IKenyaContext): Promise<void> {
	phase(3, "Trader sees the test-app dataset in catalogue");

	const catalogue = makeFederatedCatalogueClient({
		host: context.host,
		apiKey: context.traderApiKey,
		sessionJwt: context.traderSessionJwt
	});

	const { result } = await catalogue.query([], undefined, undefined, undefined);
	if (result["@type"] !== DataspaceProtocolCatalogTypes.Catalog) {
		fail(`Unexpected catalogue response: @type=${String(result["@type"])}`);
	}

	const catalog = result;
	const datasets = flattenDatasets(catalog);
	const found = datasets.find(d => d["@id"] === context.kraDatasetId);
	assert(
		found !== undefined,
		`Trader sees dataset ${context.kraDatasetId} (cross-tenant catalogue discovery works)`,
		`Trader did NOT see KRA's dataset in catalogue. Datasets returned: ${datasets
			.map(d => d["@id"])
			.join(", ")}`
	);

	const accessService = extractAccessServiceUrl(found);
	assertNonEmpty(accessService, "Catalogue dataset has a distribution.accessService URL");

	const encTenantToken = extractEncTenantToken(accessService ?? "");
	assert(
		typeof encTenantToken === "string" && encTenantToken.length > 0,
		`Distribution accessService URL carries encrypted tenantToken (${
			(encTenantToken ?? "").length
		} chars)`,
		`Distribution accessService URL is missing the x-enc-tenant-token query param: ${
			accessService ?? "<missing>"
		}`
	);

	context.kraTenantToken = encTenantToken;
	ok("Cached KRA encrypted tenantToken on the test context");
	info("This token is the TICKET-G fedcat URL-baking signature. It is now re-applied");
	info("as `?x-enc-tenant-token=...` on every subsequent PNP/DSP/PAP call so requests");
	info("land in KRA's tenant partition.");
}
