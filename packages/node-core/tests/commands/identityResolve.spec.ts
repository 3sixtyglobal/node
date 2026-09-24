// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { CLIUtils } from "@twin.org/cli-core";
import { setupCliTestContext, TENANT_MODES, UNKNOWN_DID } from "./cliTestHelper.js";

describe.each(TENANT_MODES)("identity-resolve in $mode mode", ({ mode, tenantEnabled }) => {
	const context = setupCliTestContext("identity-resolve", mode, tenantEnabled);

	test("resolves a DID to its document", async () => {
		await context.execute(["identity-resolve", `--identity=${context.state.nodeId}`]);
	});

	test("saves the full DID document to a json file", async () => {
		const outputFile = `${context.dir}identity-resolve.json`;
		await context.execute([
			"identity-resolve",
			`--identity=${context.state.nodeId}`,
			`--output-json=${outputFile}`
		]);
		const document = await CLIUtils.readJsonFile<{ id: string }>(outputFile);
		expect(document?.id).toEqual(context.state.nodeId);
	});

	test("throws when identity is not found", async () => {
		await expect(
			context.execute(["identity-resolve", `--identity=${UNKNOWN_DID}`])
		).rejects.toThrow("identityNotFound");
	});
});
