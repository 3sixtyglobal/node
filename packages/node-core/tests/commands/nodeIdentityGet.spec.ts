// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { setupCliTestContext, TENANT_MODES } from "./cliTestHelper.js";

describe.each(TENANT_MODES)("node-identity-get in $mode mode", ({ mode, tenantEnabled }) => {
	const context = setupCliTestContext("node-identity-get", mode, tenantEnabled);

	test("returns the node identity document", async () => {
		await context.execute(["node-identity-get"]);
	});

	test("throws when node identity is not set", async () => {
		await expect(context.execute(["node-identity-get"], undefined, {})).rejects.toThrow(
			"nodeIdentityNotSet"
		);
	});
});
