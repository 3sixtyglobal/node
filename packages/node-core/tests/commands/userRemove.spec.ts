// Copyright 2026 IOTA Stiftung.
// Copyright 2026 3Sixty Trade Ltd.
// SPDX-License-Identifier: Apache-2.0.
import { writeFile } from "node:fs/promises";
import { readStoreRecords, setupCliTestContext, TENANT_MODES } from "./cliTestHelper.js";

describe.each(TENANT_MODES)("user-remove in $mode mode", ({ mode, tenantEnabled }) => {
	const context = setupCliTestContext("user-remove", mode, tenantEnabled);

	/**
	 * Find the account id of a user.
	 * @param email The email address of the user.
	 * @returns The account id.
	 */
	async function accountIdOf(email: string): Promise<string | undefined> {
		const users = await readStoreRecords<{ email: string; accountId: string }>(
			context.dbDir,
			"authentication-user"
		);
		return users.find(u => u.email === email)?.accountId;
	}

	test("removes the user and their account data", async () => {
		await context.createUser("user@example.com");
		const accountId = await accountIdOf("user@example.com");
		const before = await readStoreRecords<{ accountId: string }>(context.dbDir, "account-data");
		expect(before.filter(d => d.accountId === accountId).length).toBeGreaterThan(0);

		await context.execute(["user-remove", "--email=user@example.com", ...context.tenantArgs()]);

		const users = await readStoreRecords<{ email: string }>(context.dbDir, "authentication-user");
		expect(users.some(u => u.email === "user@example.com")).toEqual(false);
		const after = await readStoreRecords<{ accountId: string }>(context.dbDir, "account-data");
		expect(after.some(d => d.accountId === accountId)).toEqual(false);
	});

	test("removes a user that has no account data", async () => {
		await context.createUser("no-profile@example.com");
		const accountId = await accountIdOf("no-profile@example.com");

		// Users created outside the CLI may not have any account data
		const accountData = await readStoreRecords<{ accountId: string }>(
			context.dbDir,
			"account-data"
		);
		await writeFile(
			`${context.dbDir}/account-data/store.json`,
			JSON.stringify(
				accountData.filter(d => d.accountId !== accountId),
				undefined,
				"\t"
			)
		);

		await context.execute([
			"user-remove",
			"--email=no-profile@example.com",
			...context.tenantArgs()
		]);

		const users = await readStoreRecords<{ email: string }>(context.dbDir, "authentication-user");
		expect(users.some(u => u.email === "no-profile@example.com")).toEqual(false);
	});

	test("removes the user when the e-mail address is given in another case", async () => {
		await context.createUser("mixed-case@example.com");

		await context.execute([
			"user-remove",
			"--email=Mixed-Case@Example.com",
			...context.tenantArgs()
		]);

		const users = await readStoreRecords<{ email: string }>(context.dbDir, "authentication-user");
		expect(users.some(u => u.email === "mixed-case@example.com")).toEqual(false);
	});

	test("throws when the user does not exist", async () => {
		await expect(
			context.execute(["user-remove", "--email=missing@example.com", ...context.tenantArgs()])
		).rejects.toThrow();
	});

	test("rejects the tenant ID when it does not match the mode", async () => {
		await context.createUser("wrong-tenancy@example.com");
		const { args, error } = context.wrongTenantArgs();
		await expect(
			context.execute(["user-remove", "--email=wrong-tenancy@example.com", ...args])
		).rejects.toThrow(error);
	});
});
