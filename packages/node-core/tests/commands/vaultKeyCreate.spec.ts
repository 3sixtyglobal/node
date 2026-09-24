// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { CLIUtils } from "@twin.org/cli-core";
import {
	readStoreRecords,
	setupCliTestContext,
	TENANT_MODES,
	valueFromEnv
} from "./cliTestHelper.js";

interface IVaultKeyOutput {
	identity: string;
	keyId: string;
	keyType: string;
	privateKeyBase64: string;
	publicKeyBase64?: string;
	privateKeyHex: string;
	publicKeyHex?: string;
}

describe.each(TENANT_MODES)("vault-key-create in $mode mode", ({ mode, tenantEnabled }) => {
	const context = setupCliTestContext("vault-key-create", mode, tenantEnabled);

	test("creates an Ed25519 key", async () => {
		await context.execute([
			"vault-key-create",
			`--identity=${context.state.nodeId}`,
			"--key-id=signing",
			`--output-json=${context.dir}signing.json`,
			`--output-env=${context.dir}signing.env`
		]);

		const json = await CLIUtils.readJsonFile<IVaultKeyOutput>(`${context.dir}signing.json`);
		const env = await CLIUtils.readLinesFile(`${context.dir}signing.env`);
		expect(json?.identity).toEqual(context.state.nodeId);
		expect(json?.identity).toEqual(valueFromEnv(env?.[0]));
		expect(json?.keyId).toEqual(valueFromEnv(env?.[1]));
		expect(json?.keyType).toEqual(valueFromEnv(env?.[2]));
		expect(json?.privateKeyBase64).toEqual(valueFromEnv(env?.[3]));
		expect(json?.publicKeyBase64).toEqual(valueFromEnv(env?.[4]));
		expect(json?.privateKeyHex).toEqual(valueFromEnv(env?.[5]));
		expect(json?.publicKeyHex).toEqual(valueFromEnv(env?.[6]));
	});

	test("creates a ChaCha20Poly1305 key", async () => {
		await context.execute([
			"vault-key-create",
			`--identity=${context.state.nodeId}`,
			"--key-id=encryption",
			"--key-type=ChaCha20Poly1305",
			`--output-json=${context.dir}encryption.json`,
			`--output-env=${context.dir}encryption.env`
		]);

		const json = await CLIUtils.readJsonFile<IVaultKeyOutput>(`${context.dir}encryption.json`);
		const env = await CLIUtils.readLinesFile(`${context.dir}encryption.env`);
		expect(json?.keyType).toEqual("ChaCha20Poly1305");
		expect(json?.identity).toEqual(valueFromEnv(env?.[0]));
		expect(json?.keyId).toEqual(valueFromEnv(env?.[1]));
		expect(json?.keyType).toEqual(valueFromEnv(env?.[2]));
		expect(json?.privateKeyBase64).toEqual(valueFromEnv(env?.[3]));
		expect(json?.privateKeyHex).toEqual(valueFromEnv(env?.[4]));
		expect(json?.publicKeyHex).toBeUndefined();
	});

	test("skips an existing key with overwrite-mode skip", async () => {
		const before = await readStoreRecords(context.dbDir, "vault-key");
		await context.execute([
			"vault-key-create",
			`--identity=${context.state.nodeId}`,
			"--key-id=signing",
			"--overwrite-mode=skip"
		]);
		expect(await readStoreRecords(context.dbDir, "vault-key")).toEqual(before);
	});

	test("throws with overwrite-mode error when key already exists", async () => {
		await expect(
			context.execute([
				"vault-key-create",
				`--identity=${context.state.nodeId}`,
				"--key-id=signing",
				"--overwrite-mode=error"
			])
		).rejects.toThrow("vaultKeyAlreadyExists");
	});

	test("recreates key with overwrite-mode overwrite", async () => {
		const before = await CLIUtils.readJsonFile<IVaultKeyOutput>(`${context.dir}signing.json`);
		await context.execute([
			"vault-key-create",
			`--identity=${context.state.nodeId}`,
			"--key-id=signing",
			"--overwrite-mode=overwrite",
			`--output-json=${context.dir}signing-overwrite.json`
		]);

		const json = await CLIUtils.readJsonFile<IVaultKeyOutput>(
			`${context.dir}signing-overwrite.json`
		);
		expect(json?.keyType).toEqual("Ed25519");
		expect(json?.privateKeyHex).toBeDefined();
		expect(json?.privateKeyHex).not.toEqual(before?.privateKeyHex);
	});
});
