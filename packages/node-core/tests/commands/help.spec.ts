// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { CLIDisplay } from "@twin.org/cli-core";
import { Factory } from "@twin.org/core";
import { executeCliCommand, OUTPUT_TMP_DIR, TENANT_MODES } from "./cliTestHelper.js";

/**
 * Capture the output written while running a help command.
 * @param args The CLI args.
 * @param tenantEnabled Whether multi-tenancy is enabled.
 * @returns The output.
 */
async function captureHelp(args: string[], tenantEnabled: boolean): Promise<string> {
	const lines: string[] = [];
	const originalWrite = CLIDisplay.write;
	CLIDisplay.write = (buf: string | Uint8Array) => {
		lines.push(buf.toString());
	};
	try {
		await executeCliCommand(args, {
			state: {},
			dbDir: `${OUTPUT_TMP_DIR}help/db`,
			tenantEnabled
		});
	} finally {
		CLIDisplay.write = originalWrite;
	}
	return lines.join("");
}

describe.each(TENANT_MODES)("help in $mode mode", ({ tenantEnabled }) => {
	// The output is coloured when the terminal supports it, so use plain text for matching
	beforeAll(() => {
		CLIDisplay.setColorEnabled(false);
	});

	afterAll(() => {
		CLIDisplay.setColorEnabled(true);
	});

	beforeEach(() => {
		Factory.clearFactories();
	});

	test("Can show the root help", async () => {
		const output = await captureHelp(["--help"], tenantEnabled);
		expect(output).toContain("bootstrap-dev");
	});

	test("Can show the help for a command", async () => {
		const output = await captureHelp(["bootstrap-dev", "--help"], tenantEnabled);
		expect(output).toContain("bootstrap-dev");
	});

	test("help listing marks single-tenant-only commands with a label", async () => {
		const output = await captureHelp(["--help"], tenantEnabled);
		expect(output).toContain("node-org-id-get");
		expect(output).toContain("single-tenant only");
	});

	test("per-command help for node-org-id-get includes single-tenant-only label", async () => {
		const output = await captureHelp(["node-org-id-get", "--help"], tenantEnabled);
		expect(output).toContain("single-tenant only");
	});

	test("per-command help labels params without a required flag as required", async () => {
		const output = await captureHelp(["user-create", "--help"], tenantEnabled);
		expect(output).toContain("email: (string, email, required)");
		expect(output).toContain("tenant-id: (string, hex(32), optional)");
	});

	test("help listing includes the remove and update commands", async () => {
		const output = await captureHelp(["--help"], tenantEnabled);
		for (const command of [
			"identity-remove",
			"tenant-remove",
			"user-remove",
			"user-update-password",
			"vault-key-remove",
			"vault-key-update"
		]) {
			expect(output).toContain(command);
		}
	});
});
