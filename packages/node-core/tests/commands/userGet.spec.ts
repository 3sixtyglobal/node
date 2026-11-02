// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { setupCliTestContext, TENANT_MODES } from "./cliTestHelper.js";

describe.each(TENANT_MODES)("user-get in $mode mode", ({ mode, tenantEnabled }) => {
	const context = setupCliTestContext("user-get", mode, tenantEnabled);

	beforeAll(async () => {
		await context.createUser("user@example.com");
	});

	test("returns the user, found by its e-mail address in any case", async () => {
		await context.execute(["user-get", "--email=user@example.com", ...context.tenantArgs()]);
		await context.execute(["user-get", "--email=USER@Example.com", ...context.tenantArgs()]);
	});

	test("throws when the user does not exist", async () => {
		await expect(
			context.execute(["user-get", "--email=missing@example.com", ...context.tenantArgs()])
		).rejects.toThrow("getUserFailed");
	});

	test("rejects the tenant ID when it does not match the mode", async () => {
		const { args, error } = context.wrongTenantArgs();
		await expect(
			context.execute(["user-get", "--email=user@example.com", ...args])
		).rejects.toThrow(error);
	});
});
