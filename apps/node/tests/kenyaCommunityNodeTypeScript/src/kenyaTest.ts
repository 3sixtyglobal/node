// Copyright 2025 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { IKenyaContext } from "./context.js";
import { readAllDotFiles, required } from "./dotfiles.js";
import { done, fail, info } from "./logger.js";
import { runPhase0 } from "./phases/phase0.js";
import { runPhase1 } from "./phases/phase1.js";
import { runPhase10 } from "./phases/phase10.js";
import { runPhase11 } from "./phases/phase11.js";
import { runPhase2 } from "./phases/phase2.js";
import { runPhase3 } from "./phases/phase3.js";
import { runPhase4and5 } from "./phases/phase4_5.js";
import { runPhase6and7 } from "./phases/phase6_7.js";
import { runPhase8and9 } from "./phases/phase8_9.js";

const HOST = "http://localhost:3040";
const INTERNAL_URL = "http://twin-kenya-node:3000";
const DSP_CONTEXT = "https://w3id.org/dspace/2025/1/context.jsonld";
const ODRL_CONTEXT = "http://www.w3.org/ns/odrl.jsonld";

/**
 * Resolve the bash scaffold directory. The TypeScript test lives at
 * `node/apps/node/tests/kenyaCommunityNodeTypeScript/` and reads the dotfiles
 * from the sibling `kenyaCommunityNodeDocker/` directory so it can reuse the
 * runtime state setup.sh + provision-storage.sh have already produced.
 * @returns The absolute path to the bash scaffold directory.
 */
function resolveScaffoldDir(): string {
	const here = path.dirname(fileURLToPath(import.meta.url));
	// here = .../kenyaCommunityNodeTypeScript/src
	// scaffold = .../kenyaCommunityNodeDocker
	return path.resolve(here, "..", "..", "kenyaCommunityNodeDocker");
}

/**
 * Build the scenario context from the bash scaffold's dotfiles. Pre-flight
 * validation rejects unset values up-front so phase failures point at the
 * right cause (missing provisioning, not an HTTP 500 mid-test).
 * @returns The hydrated context.
 */
async function loadContext(): Promise<IKenyaContext> {
	const scaffoldDir = resolveScaffoldDir();
	info(`Reading runtime state from ${scaffoldDir}`);
	const env = await readAllDotFiles(scaffoldDir);

	return {
		host: HOST,
		internalUrl: INTERNAL_URL,
		dspContext: DSP_CONTEXT,
		odrlContext: ODRL_CONTEXT,

		kraTenantId: required(env, "TENANT_KRA_TENANT_ID"),
		kraApiKey: required(env, "TENANT_KRA_API_KEY"),
		kraUserEmail: required(env, "TENANT_KRA_USER_EMAIL"),
		kraUserPassword: required(env, "TENANT_KRA_USER_PASSWORD"),
		kraDid: required(env, "KRA_DID"),

		traderTenantId: required(env, "TENANT_TRADER_TENANT_ID"),
		traderApiKey: required(env, "TENANT_TRADER_API_KEY"),
		traderUserEmail: required(env, "TENANT_TRADER_USER_EMAIL"),
		traderUserPassword: required(env, "TENANT_TRADER_USER_PASSWORD"),
		traderDid: required(env, "TRADER_DID"),

		// Session JWTs are present in .session-tokens for resilience but
		// re-issued by Phase 0 (login via the production rest client).
		kraSessionJwt: env.KRA_SESSION_JWT ?? "",
		traderSessionJwt: env.TRADER_SESSION_JWT ?? "",
		kraTrustJwt: required(env, "KRA_TRUST_JWT"),
		traderTrustJwt: required(env, "TRADER_TRUST_JWT"),
		traderTenantToken: required(env, "TRADER_TENANT_TOKEN"),

		kraOfferId: required(env, "KRA_OFFER_ID"),
		kraDatasetId: required(env, "KRA_DATASET_ID")
	};
}

/**
 * Run the full Kenya scenario end-to-end.
 */
async function main(): Promise<void> {
	const context = await loadContext();

	await runPhase0(context);
	await runPhase1(context);
	await runPhase2(context);
	await runPhase3(context);
	const negotiation = await runPhase4and5(context);
	await runPhase6and7(context, negotiation);
	await runPhase8and9(context, negotiation);
	await runPhase10(context);
	await runPhase11(context);

	done("✓ Phases 0-11 complete (pull 0-7 + push 8-9 + S4 verify 10 + negative-path isolation 11)");
}

main().catch(err => {
	if (err instanceof Error) {
		fail(err.message);
	} else {
		fail(String(err));
	}
});
