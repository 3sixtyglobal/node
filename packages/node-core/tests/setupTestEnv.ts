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
 * The ports which fetch refuses to connect to, as listed in the WHATWG fetch specification.
 * A test server bound to one of these is unreachable, so they must never be handed out.
 */
const BLOCKED_PORTS = new Set([
	1, 7, 9, 11, 13, 15, 17, 19, 20, 21, 22, 23, 25, 37, 42, 43, 53, 69, 77, 79, 87, 95, 101, 102,
	103, 104, 109, 110, 111, 113, 115, 117, 119, 123, 135, 137, 138, 139, 143, 161, 179, 389, 427,
	465, 512, 513, 514, 515, 526, 530, 531, 532, 540, 548, 554, 556, 563, 587, 601, 636, 989, 990,
	993, 995, 1719, 1720, 1723, 2049, 3659, 4045, 4190, 5060, 5061, 6000, 6566, 6665, 6666, 6667,
	6668, 6669, 6679, 6697, 10080
]);

/**
 * The number of times to ask for a port before giving up.
 */
const MAX_PORT_ATTEMPTS = 20;

/**
 * Ask the operating system for a free port.
 * @returns A port which was free at the point it was requested.
 */
async function requestFreePort(): Promise<number> {
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

/**
 * Ask the operating system for a free port, so that test servers do not clash
 * with each other when test files run in parallel, or with ports the host
 * has reserved. Ports which fetch will not connect to are skipped.
 * @returns A port which was free at the point it was requested.
 * @throws If no usable port was found.
 */
export async function getFreePort(): Promise<number> {
	for (let attempt = 0; attempt < MAX_PORT_ATTEMPTS; attempt++) {
		const freePort = await requestFreePort();
		if (freePort > 0 && !BLOCKED_PORTS.has(freePort)) {
			return freePort;
		}
	}
	throw new Error(
		`Unable to find a usable free port after ${MAX_PORT_ATTEMPTS} attempts, all the ports offered were blocked`
	);
}
