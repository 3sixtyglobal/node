// Copyright 2026 IOTA Stiftung.
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
	did: string;
	organizationDid: string;
	email: string;
	password: string;
	scope: string[];
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
			"--scope=tenant-admin,doo",
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
		expect(json?.scope.join(",")).toEqual(valueFromEnv(env?.[4]));
		expect(json?.givenName).toEqual(valueFromEnv(env?.[5]));
		expect(json?.familyName).toEqual(valueFromEnv(env?.[6]));

		const users = await readStoreRecords<{ email: string; scope: string; partitionId: string }>(
			context.dbDir,
			"authentication-user"
		);
		const user = users.find(u => u.email === "user@example.com");
		expect(user?.scope).toEqual("tenant-admin,doo");

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
			"--scope=tenant-admin",
			"--overwrite-mode=overwrite",
			`--output-json=${context.dir}user-overwrite.json`
		]);

		const json = await CLIUtils.readJsonFile<IUserOutput>(`${context.dir}user-overwrite.json`);
		expect(json?.email).toEqual("user@example.com");
		expect(json?.scope).toEqual(["tenant-admin"]);
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
