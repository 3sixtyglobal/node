// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { CLIUtils } from "@twin.org/cli-core";
import {
	readStoreRecords,
	setupCliTestContext,
	TENANT_MODES,
	valueFromEnv
} from "./cliTestHelper.js";

const NEW_PASSWORD = "N3w!Long-Passw0rd#2026";

describe.each(TENANT_MODES)("user-update-password in $mode mode", ({ mode, tenantEnabled }) => {
	const context = setupCliTestContext("user-update-password", mode, tenantEnabled);

	beforeAll(async () => {
		await context.createUser("user@example.com");
	});

	/**
	 * Read the stored password hash for the test user.
	 * @returns The password hash.
	 */
	async function readPasswordHash(): Promise<string | undefined> {
		const users = await readStoreRecords<{ email: string; password: string }>(
			context.dbDir,
			"authentication-user"
		);
		return users.find(u => u.email === "user@example.com")?.password;
	}

	test("updates the password to the one provided", async () => {
		const hashBefore = await readPasswordHash();
		await context.execute([
			"user-update-password",
			"--email=user@example.com",
			`--password=${NEW_PASSWORD}`,
			...context.tenantArgs()
		]);
		expect(await readPasswordHash()).not.toEqual(hashBefore);
	});

	test("generates a password and verifies the current password", async () => {
		const hashBefore = await readPasswordHash();
		await context.execute([
			"user-update-password",
			"--email=user@example.com",
			`--current-password=${NEW_PASSWORD}`,
			`--output-json=${context.dir}password.json`,
			`--output-env=${context.dir}password.env`,
			"--output-env-prefix=user_",
			...context.tenantArgs()
		]);

		const json = await CLIUtils.readJsonFile<{ email: string; password: string }>(
			`${context.dir}password.json`
		);
		const env = await CLIUtils.readLinesFile(`${context.dir}password.env`);
		expect(json?.email).toEqual("user@example.com");
		expect(json?.password).toHaveLength(16);
		expect(json?.email).toEqual(valueFromEnv(env?.[0]));
		expect(json?.password).toEqual(valueFromEnv(env?.[1]));
		expect(await readPasswordHash()).not.toEqual(hashBefore);
	});

	test("throws when the current password is wrong", async () => {
		await expect(
			context.execute([
				"user-update-password",
				"--email=user@example.com",
				`--password=${NEW_PASSWORD}`,
				"--current-password=N0t!The-Current#Passw0rd",
				...context.tenantArgs()
			])
		).rejects.toThrow("updatePasswordFailed");
	});

	test("throws when the password is too short", async () => {
		await expect(
			context.execute([
				"user-update-password",
				"--email=user@example.com",
				"--password=short",
				...context.tenantArgs()
			])
		).rejects.toThrow("updatePasswordFailed");
	});

	test("throws when the user does not exist", async () => {
		await expect(
			context.execute([
				"user-update-password",
				"--email=missing@example.com",
				`--password=${NEW_PASSWORD}`,
				...context.tenantArgs()
			])
		).rejects.toThrow("updatePasswordFailed");
	});

	test("rejects the tenant ID when it does not match the mode", async () => {
		const { args, error } = context.wrongTenantArgs();
		await expect(
			context.execute(["user-update-password", "--email=user@example.com", ...args])
		).rejects.toThrow(error);
	});
});
