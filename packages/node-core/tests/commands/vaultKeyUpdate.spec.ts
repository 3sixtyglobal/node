// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { Converter, RandomHelper } from "@3sixty/core";
import { VaultKeyType } from "@3sixty/vault-models";
import { readStoreRecords, setupCliTestContext, TENANT_MODES } from "./cliTestHelper.js";

interface IVaultKeyRecord {
	id: string;
	type: number;
	privateKey: string;
	publicKey?: string;
}

describe.each(TENANT_MODES)("vault-key-update in $mode mode", ({ mode, tenantEnabled }) => {
	const context = setupCliTestContext("vault-key-update", mode, tenantEnabled);

	/**
	 * Read a vault key record for the node identity.
	 * @param keyId The ID of the key.
	 * @returns The record.
	 */
	async function readKey(keyId: string): Promise<IVaultKeyRecord | undefined> {
		const keys = await readStoreRecords<IVaultKeyRecord>(context.dbDir, "vault-key");
		return keys.find(k => k.id === `${context.state.nodeId}/${keyId}`);
	}

	test("replaces the material of an Ed25519 key", async () => {
		await context.execute([
			"vault-key-create",
			`--identity=${context.state.nodeId}`,
			"--key-id=signing"
		]);
		const before = await readKey("signing");

		const newPrivateKey = RandomHelper.generate(32);
		await context.execute([
			"vault-key-update",
			`--identity=${context.state.nodeId}`,
			"--key-id=signing",
			`--private-key-hex=${Converter.bytesToHex(newPrivateKey, true)}`
		]);

		const after = await readKey("signing");
		expect(after?.type).toEqual(VaultKeyType.Ed25519);
		expect(after?.privateKey).toEqual(Converter.bytesToBase64(newPrivateKey));
		expect(after?.publicKey).toBeDefined();
		expect(after?.publicKey).not.toEqual(before?.publicKey);
	});

	test("keeps the type of a ChaCha20Poly1305 key", async () => {
		await context.execute([
			"vault-key-create",
			`--identity=${context.state.nodeId}`,
			"--key-id=encryption",
			"--key-type=ChaCha20Poly1305"
		]);

		const newPrivateKey = RandomHelper.generate(32);
		await context.execute([
			"vault-key-update",
			`--identity=${context.state.nodeId}`,
			"--key-id=encryption",
			`--private-key-hex=${Converter.bytesToHex(newPrivateKey, true)}`
		]);

		const after = await readKey("encryption");
		expect(after?.type).toEqual(VaultKeyType.ChaCha20Poly1305);
		expect(after?.privateKey).toEqual(Converter.bytesToBase64(newPrivateKey));
	});

	test("throws when the key does not exist", async () => {
		await expect(
			context.execute([
				"vault-key-update",
				`--identity=${context.state.nodeId}`,
				"--key-id=missing",
				`--private-key-hex=${Converter.bytesToHex(RandomHelper.generate(32), true)}`
			])
		).rejects.toThrow("vaultKeyNotFound");
	});
});
