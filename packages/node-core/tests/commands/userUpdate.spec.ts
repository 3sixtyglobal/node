// Copyright 2026 IOTA Stiftung.
// Copyright 2026 3Sixty Trade Ltd.
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
			`--user-identity=${userIdentity}`,
			"--roles=tenant-admin,user-admin",
			"--given-name=Admin",
			"--family-name=Node",
			...context.tenantArgs()
		]);

		const users = await readStoreRecords<{ email: string; accountId: string }>(
			context.dbDir,
			"authentication-user"
		);
		const accountId = users.find(u => u.email === "user@example.com")?.accountId;

		// Roles are held by the account id.
		const roleAssignments = await readStoreRecords<{ subject: string; role: string }>(
			context.dbDir,
			"authorization-role-assignment"
		);
		expect(
			roleAssignments
				.filter(r => r.subject === accountId)
				.map(r => r.role)
				.sort()
		).toEqual(["tenant-admin", "user-admin"]);
		expect(roleAssignments.some(r => r.subject === userIdentity)).toBe(false);
		const accountData = await readStoreRecords<{
			accountId: string;
			type: string;
			isDefault: boolean;
			data: { givenName: string; familyName: string };
		}>(context.dbDir, "account-data");
		const profiles = accountData.filter(d => d.accountId === accountId && d.type === "profile");
		expect(profiles).toHaveLength(1);
		expect(profiles[0].isDefault).toEqual(true);
		expect(profiles[0].data.givenName).toEqual("Admin");
		expect(profiles[0].data.familyName).toEqual("Node");
	});

	test("uses the stored identity when none is given", async () => {
		await context.execute([
			"user-update",
			"--email=user@example.com",
			"--roles=user-admin",
			...context.tenantArgs()
		]);

		const users = await readStoreRecords<{ email: string; accountId: string }>(
			context.dbDir,
			"authentication-user"
		);
		const accountId = users.find(u => u.email === "user@example.com")?.accountId;
		const roleAssignments = await readStoreRecords<{ subject: string; role: string }>(
			context.dbDir,
			"authorization-role-assignment"
		);
		expect(roleAssignments.filter(r => r.subject === accountId).map(r => r.role)).toEqual([
			"user-admin"
		]);
	});

	test("joins the organization given once, adding nothing when it is a member", async () => {
		await context.execute([
			"user-update",
			"--email=User@Example.com",
			`--organization-identity=${context.organizationId}`,
			...context.tenantArgs()
		]);

		const users = await readStoreRecords<{ email: string; accountId: string }>(
			context.dbDir,
			"authentication-user"
		);
		const accountId = users.find(u => u.email === "user@example.com")?.accountId;
		const accountData = await readStoreRecords<{
			accountId: string;
			type: string;
			data: unknown;
			isDefault: boolean;
		}>(context.dbDir, "account-data");
		const items = accountData.filter(item => item.accountId === accountId);
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
		expect(items.filter(item => item.type === "vc")).toHaveLength(1);
	});

	test("throws when the organization cannot issue a membership credential", async () => {
		const organization = await context.createIdentity("unsigned-organization");
		await expect(
			context.execute([
				"user-update",
				"--email=user@example.com",
				`--organization-identity=${organization.did}`,
				...context.tenantArgs()
			])
		).rejects.toThrow();
	});

	test("throws when user is not found", async () => {
		await expect(
			context.execute([
				"user-update",
				"--email=nonexistent@example.com",
				`--user-identity=${userIdentity}`,
				...context.tenantArgs()
			])
		).rejects.toThrow("getUserFailed");
	});

	test("rejects the tenant ID when it does not match the mode", async () => {
		const { args, error } = context.wrongTenantArgs();
		await expect(
			context.execute([
				"user-update",
				"--email=user@example.com",
				`--user-identity=${userIdentity}`,
				...args
			])
		).rejects.toThrow(error);
	});
});
