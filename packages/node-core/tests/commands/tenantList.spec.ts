// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { setupCliTestContext, TENANT_MODES } from "./cliTestHelper.js";

describe.each(TENANT_MODES)("tenant-list in $mode mode", ({ mode, tenantEnabled }) => {
	const context = setupCliTestContext("tenant-list", mode, tenantEnabled);

	test("returns all tenants", async () => {
		await context.expectMultiTenantOnly(["tenant-list"]);
	});
});
