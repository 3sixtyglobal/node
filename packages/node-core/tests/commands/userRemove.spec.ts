// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { writeFile } from "node:fs/promises";
import { readStoreRecords, setupCliTestContext, TENANT_MODES } from "./cliTestHelper.js";

describe.each(TENANT_MODES)("user-remove in $mode mode", ({ mode, tenantEnabled }) => {
	const context = setupCliTestContext("user-remove", mode, tenantEnabled);

	test("removes the user and their profile", async () => {
		const user = await context.createUser("user@example.com");

		await context.execute(["user-remove", "--email=user@example.com", ...context.tenantArgs()]);

		const users = await readStoreRecords<{ email: string }>(context.dbDir, "authentication-user");
		expect(users.some(u => u.email === "user@example.com")).toEqual(false);
		const profiles = await readStoreRecords<{ identity: string }>(
			context.dbDir,
			"identity-profile"
		);
		expect(profiles.some(p => p.identity === user.did)).toEqual(false);
	});

	test("removes a user that has no profile", async () => {
		const user = await context.createUser("no-profile@example.com");

		// Users created outside the CLI may not have a profile
		const profilesPath = `${context.dbDir}/identity-profile/store.json`;
		const profiles = await readStoreRecords<{ identity: string }>(
			context.dbDir,
			"identity-profile"
		);
		await writeFile(
			profilesPath,
			JSON.stringify(
				profiles.filter(p => p.identity !== user.did),
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
