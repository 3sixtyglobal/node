// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { setupCliTestContext, TENANT_MODES, UNKNOWN_DID } from "./cliTestHelper.js";

describe.each(TENANT_MODES)("node-identity-set in $mode mode", ({ mode, tenantEnabled }) => {
	const context = setupCliTestContext("node-identity-set", mode, tenantEnabled);

	test("sets the node identity", async () => {
		const identity = await context.createIdentity("node-identity");
		const state = await context.execute(
			["node-identity-set", `--identity=${identity.did}`],
			{},
			{}
		);
		expect(state).toEqual({ nodeId: identity.did });
	});

	test("node-set-identity alias still works", async () => {
		const identity = await context.createIdentity("node-identity-alias");
		const state = await context.execute(
			["node-set-identity", `--identity=${identity.did}`],
			{},
			{}
		);
		expect(state).toEqual({ nodeId: identity.did });
	});

	test("throws when the identity does not exist", async () => {
		await expect(
			context.execute(["node-identity-set", `--identity=${UNKNOWN_DID}`], {}, {})
		).rejects.toThrow("identityNotFound");
	});
});
