// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { readStoreRecords, setupCliTestContext, TENANT_MODES } from "./cliTestHelper.js";

describe.each(TENANT_MODES)("user-update in $mode mode", ({ mode, tenantEnabled }) => {
	const context = setupCliTestContext("user-update", mode, tenantEnabled);

	let userIdentity = "";

	beforeAll(async () => {
		userIdentity = (await context.createUser("user@example.com")).did;
	});

	test("updates the user and profile", async () => {
		await context.execute([
			"user-update",
			"--email=user@example.com",
			"--scope=tenant-admin,doo",
			"--given-name=Admin",
			"--family-name=Node",
			...context.tenantArgs()
		]);

		const users = await readStoreRecords<{ email: string; scope: string }>(
			context.dbDir,
			"authentication-user"
		);
		expect(users.find(u => u.email === "user@example.com")?.scope).toEqual("tenant-admin,doo");

		const profiles = await readStoreRecords<{
			identity: string;
			privateProfile: { givenName: string; familyName: string };
		}>(context.dbDir, "identity-profile");
		const profile = profiles.find(p => p.identity === userIdentity);
		expect(profile?.privateProfile.givenName).toEqual("Admin");
		expect(profile?.privateProfile.familyName).toEqual("Node");
	});

	test("throws when user is not found", async () => {
		await expect(
			context.execute(["user-update", "--email=nonexistent@example.com", ...context.tenantArgs()])
		).rejects.toThrow();
	});

	test("rejects the tenant ID when it does not match the mode", async () => {
		const { args, error } = context.wrongTenantArgs();
		await expect(
			context.execute(["user-update", "--email=user@example.com", ...args])
		).rejects.toThrow(error);
	});
});
