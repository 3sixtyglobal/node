// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import {
	readStoreRecords,
	setupCliTestContext,
	TENANT_MODES,
	UNKNOWN_DID
} from "./cliTestHelper.js";

describe.each(TENANT_MODES)("identity-remove in $mode mode", ({ mode, tenantEnabled }) => {
	const context = setupCliTestContext("identity-remove", mode, tenantEnabled);

	/**
	 * Create an identity with a verification method key in the vault.
	 * @param name A unique name for the identity.
	 * @returns The DID of the identity.
	 */
	async function createIdentityWithMethod(name: string): Promise<string> {
		const identity = await context.createIdentity(name);
		await context.execute([
			"identity-verification-method-create",
			`--identity=${identity.did}`,
			"--verification-method-id=vm-test"
		]);
		return identity.did;
	}

	test("removes the identity and its keys", async () => {
		const did = await createIdentityWithMethod("with-keys");

		await context.execute(["identity-remove", `--identity=${did}`, "--remove-keys=true"]);

		const documents = await readStoreRecords<{ id: string }>(context.dbDir, "identity-document");
		expect(documents.some(d => d.id === did)).toEqual(false);
		const keys = await readStoreRecords<{ id: string }>(context.dbDir, "vault-key");
		expect(keys.some(k => k.id.startsWith(`${did}/`))).toEqual(false);
		const secrets = await readStoreRecords<{ id: string }>(context.dbDir, "vault-secret");
		expect(secrets.some(s => s.id.startsWith(`${did}/`))).toEqual(false);

		await expect(context.execute(["identity-resolve", `--identity=${did}`])).rejects.toThrow(
			"identityNotFound"
		);
	});

	test("keeps the keys when remove-keys is not set", async () => {
		const did = await createIdentityWithMethod("without-keys");

		await context.execute(["identity-remove", `--identity=${did}`]);

		const documents = await readStoreRecords<{ id: string }>(context.dbDir, "identity-document");
		expect(documents.some(d => d.id === did)).toEqual(false);
		const keys = await readStoreRecords<{ id: string }>(context.dbDir, "vault-key");
		expect(keys.some(k => k.id === `${did}/vm-test`)).toEqual(true);
		expect(keys.some(k => k.id === `${did}/did`)).toEqual(true);
	});

	test("throws when the identity does not exist", async () => {
		await expect(context.execute(["identity-remove", `--identity=${UNKNOWN_DID}`])).rejects.toThrow(
			"removeDocumentFailed"
		);
	});

	test("refuses to remove the node identity", async () => {
		await expect(
			context.execute(["identity-remove", `--identity=${context.state.nodeId}`])
		).rejects.toThrow("nodeIdentityNotRemovable");
	});

	test.skipIf(tenantEnabled)("refuses to remove the node organization identity", async () => {
		await expect(
			context.execute(["identity-remove", `--identity=${context.organizationId}`])
		).rejects.toThrow("nodeOrganizationIdentityNotRemovable");
	});
});
