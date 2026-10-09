// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { readFile, writeFile } from "node:fs/promises";
import { CLIUtils } from "@3sixty/cli-core";
import { setupCliTestContext, TENANT_MODES, valueFromEnv } from "./cliTestHelper.js";

interface IVerificationMethodOutput {
	verificationMethodId: string;
	verificationMethodType: string;
	privateKeyJwk: {
		kid: string;
		kty: string;
		use: string;
		alg: string;
		crv: string;
		x: string;
		d: string;
	};
	privateKeyHex: string;
	publicKeyHex: string;
	privateKeyBase64: string;
	publicKeyBase64: string;
}

describe.each(TENANT_MODES)(
	"identity-verification-method-create in $mode mode",
	({ mode, tenantEnabled }) => {
		const context = setupCliTestContext("identity-verification-method-create", mode, tenantEnabled);

		let organizationDid = "";

		beforeAll(async () => {
			const organization = await context.createIdentity("organization");
			organizationDid = organization.did;
		});

		test("creates a verification method and outputs its keys", async () => {
			await context.execute([
				"identity-verification-method-create",
				`--identity=${organizationDid}`,
				"--verification-method-id=attestation-assertion",
				`--output-json=${context.dir}attestation.json`,
				`--output-env=${context.dir}attestation.env`
			]);

			const json = await CLIUtils.readJsonFile<IVerificationMethodOutput>(
				`${context.dir}attestation.json`
			);
			const env = await CLIUtils.readLinesFile(`${context.dir}attestation.env`);
			expect(json?.verificationMethodId).toEqual(`${organizationDid}#attestation-assertion`);
			expect(json?.verificationMethodId).toEqual(valueFromEnv(env?.[0]));
			expect(json?.verificationMethodType).toEqual(valueFromEnv(env?.[1]));
			expect(json?.privateKeyJwk?.kid).toEqual(valueFromEnv(env?.[2]));
			expect(json?.privateKeyJwk?.kty).toEqual(valueFromEnv(env?.[3]));
			expect(json?.privateKeyJwk?.use).toEqual(valueFromEnv(env?.[4]));
			expect(json?.privateKeyJwk?.alg).toEqual(valueFromEnv(env?.[5]));
			expect(json?.privateKeyJwk?.crv).toEqual(valueFromEnv(env?.[6]));
			expect(json?.privateKeyJwk?.x).toEqual(valueFromEnv(env?.[7]));
			expect(json?.privateKeyJwk?.d).toEqual(valueFromEnv(env?.[8]));
			expect(json?.privateKeyHex).toEqual(valueFromEnv(env?.[9]));
			expect(json?.publicKeyHex).toEqual(valueFromEnv(env?.[10]));
			expect(json?.privateKeyBase64).toEqual(valueFromEnv(env?.[11]));
			expect(json?.publicKeyBase64).toEqual(valueFromEnv(env?.[12]));
		});

		test("throws with overwrite-mode error when method already exists", async () => {
			await expect(
				context.execute([
					"identity-verification-method-create",
					`--identity=${organizationDid}`,
					"--verification-method-id=attestation-assertion",
					"--overwrite-mode=error"
				])
			).rejects.toThrow("verificationMethodAlreadyExists");
		});

		test("recreates method with overwrite-mode overwrite", async () => {
			await context.execute([
				"identity-verification-method-create",
				`--identity=${organizationDid}`,
				"--verification-method-id=attestation-assertion",
				"--overwrite-mode=overwrite",
				`--output-json=${context.dir}attestation-overwrite.json`
			]);

			const json = await CLIUtils.readJsonFile<IVerificationMethodOutput>(
				`${context.dir}attestation-overwrite.json`
			);
			expect(json?.verificationMethodId).toEqual(`${organizationDid}#attestation-assertion`);
			expect(json?.privateKeyHex).toBeDefined();
			expect(json?.publicKeyHex).toBeDefined();
		});

		test("re-creates a verification method when vault key is missing in skip mode", async () => {
			await context.execute([
				"identity-verification-method-create",
				`--identity=${organizationDid}`,
				"--verification-method-id=trust-assertion"
			]);

			// Remove the vault key to simulate a vault and identity desync
			const vaultKeyStorePath = `${context.dbDir}/vault-key/store.json`;
			const vaultKeys = JSON.parse(await readFile(vaultKeyStorePath, "utf8")) as { id: string }[];
			const keyId = `${organizationDid}/trust-assertion`;
			expect(vaultKeys.some(k => k.id === keyId)).toEqual(true);
			await writeFile(
				vaultKeyStorePath,
				JSON.stringify(
					vaultKeys.filter(k => k.id !== keyId),
					undefined,
					"\t"
				)
			);

			await context.execute([
				"identity-verification-method-create",
				`--identity=${organizationDid}`,
				"--verification-method-id=trust-assertion",
				"--overwrite-mode=skip",
				`--output-json=${context.dir}trust-recovered.json`
			]);

			const json = await CLIUtils.readJsonFile<IVerificationMethodOutput>(
				`${context.dir}trust-recovered.json`
			);
			expect(json?.verificationMethodId).toEqual(`${organizationDid}#trust-assertion`);
			const vaultKeysAfter = JSON.parse(await readFile(vaultKeyStorePath, "utf8")) as {
				id: string;
			}[];
			expect(vaultKeysAfter.some(k => k.id === keyId)).toEqual(true);
		});
	}
);
