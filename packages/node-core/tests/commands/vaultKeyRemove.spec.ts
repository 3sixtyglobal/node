// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { readStoreRecords, setupCliTestContext, TENANT_MODES } from "./cliTestHelper.js";

describe.each(TENANT_MODES)("vault-key-remove in $mode mode", ({ mode, tenantEnabled }) => {
	const context = setupCliTestContext("vault-key-remove", mode, tenantEnabled);

	test("removes a key", async () => {
		await context.execute([
			"vault-key-create",
			`--identity=${context.state.nodeId}`,
			"--key-id=to-remove"
		]);

		await context.execute([
			"vault-key-remove",
			`--identity=${context.state.nodeId}`,
			"--key-id=to-remove"
		]);

		const keys = await readStoreRecords<{ id: string }>(context.dbDir, "vault-key");
		expect(keys.some(k => k.id === `${context.state.nodeId}/to-remove`)).toEqual(false);
	});

	test("throws when the key does not exist", async () => {
		await expect(
			context.execute([
				"vault-key-remove",
				`--identity=${context.state.nodeId}`,
				"--key-id=to-remove"
			])
		).rejects.toThrow("vaultKeyNotFound");
	});
});
