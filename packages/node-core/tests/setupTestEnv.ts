// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { createServer } from "node:net";
import { Is } from "@twin.org/core";

/**
 * CI environments (e.g. GitHub Actions) set TWIN_GPG_KEY_ID for signing.
 * This variable is unknown to the engine's env-var validation, so tests
 * that go through `run()` - which merges process.env - must include it in
 * their TWIN_ENV_ALLOW_LIST to avoid a strict-mode validation failure.
 */
export const CI_ENV_VARS = process.env.CI === "true" ? "TWIN_GPG_KEY_ID" : "";

/**
 * Ask the operating system for a free port, so that test servers do not clash
 * with each other when test files run in parallel, or with ports the host
 * has reserved.
 * @returns A port which was free at the point it was requested.
 */
export async function getFreePort(): Promise<number> {
	return new Promise<number>((resolve, reject) => {
		const server = createServer();
		server.on("error", reject);
		server.listen(0, "127.0.0.1", () => {
			const address = server.address();
			const freePort = Is.object<{ port: number }>(address) ? address.port : 0;
			server.close(() => resolve(freePort));
		});
	});
}
