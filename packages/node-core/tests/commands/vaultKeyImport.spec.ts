// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { Converter, RandomHelper } from "@3sixty/core";
import { readStoreRecords, setupCliTestContext, TENANT_MODES } from "./cliTestHelper.js";

describe.each(TENANT_MODES)("vault-key-import in $mode mode", ({ mode, tenantEnabled }) => {
	const context = setupCliTestContext("vault-key-import", mode, tenantEnabled);

	test("imports a key", async () => {
		const privateKey = RandomHelper.generate(32);
		await context.execute([
			"vault-key-import",
			`--identity=${context.state.nodeId}`,
			"--key-id=imported",
			"--key-type=Ed25519",
			`--private-key-hex=${Converter.bytesToHex(privateKey, true)}`
		]);

		const keys = await readStoreRecords<{ id: string; privateKey: string }>(
			context.dbDir,
			"vault-key"
		);
		const key = keys.find(k => k.id === `${context.state.nodeId}/imported`);
		expect(key?.privateKey).toEqual(Converter.bytesToBase64(privateKey));
	});
});
