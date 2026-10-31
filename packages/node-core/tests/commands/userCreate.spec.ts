// Copyright 2026 IOTA Stiftung.
// Copyright 2026 3Sixty Trade Ltd.
// SPDX-License-Identifier: Apache-2.0.
import { CLIUtils } from "@3sixty/cli-core";
import { Converter } from "@3sixty/core";
import {
	readStoreRecords,
	setupCliTestContext,
	TENANT_MODES,
	valueFromEnv
} from "./cliTestHelper.js";

interface IUserOutput {
	accountId: string;
	did: string;
	organizationDid: string;
	email: string;
	password: string;
	roles: string[];
	givenName: string;
	familyName: string;
}

describe.each(TENANT_MODES)("user-create in $mode mode", ({ mode, tenantEnabled }) => {
	const context = setupCliTestContext("user-create", mode, tenantEnabled);

	let userIdentity = "";

	beforeAll(async () => {
		userIdentity = (await context.createIdentity("user-identity")).did;
	});

	/**
	 * The arguments for creating the test user.
	 * @param email The email address for the user.
	 * @returns The arguments.
	 */
	function userArgs(email: string): string[] {
		return [
			"user-create",
			`--user-identity=${userIdentity}`,
			`--organization-identity=${context.organizationId}`,
			`--email=${email}`
		];
	}

	test("creates the user account", async () => {
		await context.execute([
			...userArgs("user@example.com"),
			...context.tenantArgs(),
			"--roles=tenant-admin,user-admin",
			`--output-json=${context.dir}user.json`,
			`--output-env=${context.dir}user.env`,
			"--output-env-prefix=user"
		]);

		const json = await CLIUtils.readJsonFile<IUserOutput>(`${context.dir}user.json`);
		const env = await CLIUtils.readLinesFile(`${context.dir}user.env`);
		expect(json?.did).toEqual(valueFromEnv(env?.[0]));
		expect(json?.organizationDid).toEqual(valueFromEnv(env?.[1]));
		expect(json?.email).toEqual(valueFromEnv(env?.[2]));
		expect(json?.password).toEqual(valueFromEnv(env?.[3]));
		expect(json?.roles.join(",")).toEqual(valueFromEnv(env?.[4]));
		expect(json?.givenName).toEqual(valueFromEnv(env?.[5]));
		expect(json?.familyName).toEqual(valueFromEnv(env?.[6]));
		expect(json?.accountId).toEqual(valueFromEnv(env?.[7]));

		const users = await readStoreRecords<{ email: string; partitionId: string }>(
			context.dbDir,
			"authentication-user"
		);
		const user = users.find(u => u.email === "user@example.com");

		const roleAssignments = await readStoreRecords<{ subject: string; role: string }>(
			context.dbDir,
			"authorization-role-assignment"
		);
		// Roles are held by the account id.
		expect(
			roleAssignments
				.filter(r => r.subject === json?.accountId)
				.map(r => r.role)
				.sort()
		).toEqual(["tenant-admin", "user-admin"]);
		expect(roleAssignments.some(r => r.subject === userIdentity)).toBe(false);

		// The user joined the organization directly, with a membership credential.
		const accountData = await readStoreRecords<{
			accountId: string;
			type: string;
			data: unknown;
			isDefault: boolean;
		}>(context.dbDir, "account-data");
		const items = accountData.filter(item => item.accountId === json?.accountId);
		expect(items.filter(item => item.type === "organization")).toMatchObject([
			{
				data: {
					"@context": "https://schema.org",
					"@type": "Organization",
					identifier: context.organizationId
				},
				isDefault: true
			}
		]);
		// The membership credential is stored as JSON with its embedded proof.
		expect(items.filter(item => item.type === "vc")).toMatchObject([
			{
				data: {
					type: expect.arrayContaining(["VerifiableCredential"]),
					issuer: context.organizationId,
					credentialSubject: { id: userIdentity, memberOf: { id: context.organizationId } },
					proof: { type: "DataIntegrityProof" }
				}
			}
		]);
		expect(items.filter(item => item.type === "identity")).toMatchObject([
			{ data: { "@context": "https://www.w3.org/ns/did/v1", id: userIdentity }, isDefault: true }
		]);

		const nodeIdParts = (context.state.nodeId ?? "").split(":");
		const nodePartitionId = Converter.bytesToBase64Url(Converter.hexToBytes(nodeIdParts[2]));
		const expectedPartitionId = tenantEnabled
			? `${nodePartitionId}/${Converter.bytesToBase64Url(Converter.hexToBytes(context.tenantId ?? ""))}`
			: nodePartitionId;
		expect(user?.partitionId).toEqual(expectedPartitionId);
	});

	test("skips an existing user with overwrite-mode skip", async () => {
		await context.execute([
			...userArgs("user@example.com"),
			...context.tenantArgs(),
			"--overwrite-mode=skip"
		]);
	});

	test("throws with overwrite-mode error when user already exists", async () => {
		await expect(
			context.execute([
				...userArgs("user@example.com"),
				...context.tenantArgs(),
				"--overwrite-mode=error"
			])
		).rejects.toThrow("userAlreadyExists");
	});

	test("replaces user with overwrite-mode overwrite", async () => {
		await context.execute([
			...userArgs("user@example.com"),
			...context.tenantArgs(),
			"--roles=tenant-admin",
			"--overwrite-mode=overwrite",
			`--output-json=${context.dir}user-overwrite.json`
		]);

		const json = await CLIUtils.readJsonFile<IUserOutput>(`${context.dir}user-overwrite.json`);
		expect(json?.email).toEqual("user@example.com");
		expect(json?.roles).toEqual(["tenant-admin"]);
	});

	test("stores the names in the profiles and uses the given password", async () => {
		const namedIdentity = (await context.createIdentity("named-identity")).did;
		await context.execute([
			"user-create",
			`--user-identity=${namedIdentity}`,
			`--organization-identity=${context.organizationId}`,
			"--email=named@example.com",
			...context.tenantArgs(),
			"--password=Named@Password12345!",
			"--given-name=Ada",
			"--family-name=Lovelace",
			`--output-json=${context.dir}named.json`
		]);

		const json = await CLIUtils.readJsonFile<IUserOutput>(`${context.dir}named.json`);
		expect(json).toMatchObject({
			password: "Named@Password12345!",
			givenName: "Ada",
			familyName: "Lovelace",
			roles: ["user"]
		});

		const accountData = await readStoreRecords<{
			accountId: string;
			type: string;
			data: { name?: string; givenName?: string; familyName?: string; email?: string };
		}>(context.dbDir, "account-data");
		const items = accountData.filter(item => item.accountId === json?.accountId);
		expect(items.find(item => item.type === "public-profile")?.data.name).toBe("Ada Lovelace");
		expect(items.find(item => item.type === "private-profile")?.data).toMatchObject({
			givenName: "Ada",
			familyName: "Lovelace",
			email: "named@example.com"
		});
	});

	test("skips an existing user, found in any case, when no overwrite mode is given", async () => {
		await context.execute([
			...userArgs("NAMED@example.com"),
			...context.tenantArgs(),
			"--given-name=Other",
			`--output-json=${context.dir}named-again.json`
		]);

		// Nothing is written for a skipped user.
		await expect(
			CLIUtils.readJsonFile<IUserOutput>(`${context.dir}named-again.json`)
		).resolves.toBeUndefined();
	});

	test("throws when password is too short", async () => {
		await expect(
			context.execute([
				...userArgs("short-password@example.com"),
				...context.tenantArgs(),
				"--password=tooshort"
			])
		).rejects.toThrow("createUserFailed");
	});

	test("rejects the tenant ID when it does not match the mode", async () => {
		const { args, error } = context.wrongTenantArgs();
		await expect(
			context.execute([...userArgs("wrong-tenancy@example.com"), ...args])
		).rejects.toThrow(error);
	});
});
