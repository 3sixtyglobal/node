// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { setupCliTestContext, TENANT_MODES, UNKNOWN_DID } from "./cliTestHelper.js";

describe.each(TENANT_MODES)("identity-import in $mode mode", ({ mode, tenantEnabled }) => {
	const context = setupCliTestContext("identity-import", mode, tenantEnabled);

	test("imports an existing identity", async () => {
		const identity = await context.createIdentity("identity");
		await context.execute([
			"identity-import",
			`--identity=${identity.did}`,
			`--mnemonic=${identity.mnemonic}`
		]);
	});

	test("throws when the identity does not exist", async () => {
		const identity = await context.createIdentity("identity-for-mnemonic");
		await expect(
			context.execute([
				"identity-import",
				`--identity=${UNKNOWN_DID}`,
				`--mnemonic=${identity.mnemonic}`
			])
		).rejects.toThrow("identityNotFound");
	});

	test("throws when the mnemonic is invalid", async () => {
		await expect(
			context.execute([
				"identity-import",
				`--identity=${context.state.nodeId}`,
				"--mnemonic=not a valid mnemonic"
			])
		).rejects.toThrow("invalidMnemonic");
	});
});
