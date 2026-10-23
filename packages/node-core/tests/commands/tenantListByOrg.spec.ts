// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { setupCliTestContext, TENANT_MODES, UNKNOWN_DID } from "./cliTestHelper.js";

describe.each(TENANT_MODES)("tenant-list-by-org in $mode mode", ({ mode, tenantEnabled }) => {
	const context = setupCliTestContext("tenant-list-by-org", mode, tenantEnabled);

	test("returns tenants for the given org", async () => {
		await context.expectMultiTenantOnly([
			"tenant-list-by-org",
			`--org-id=${context.organizationId}`
		]);
	});

	test("returns empty list for unknown org", async () => {
		await context.expectMultiTenantOnly(["tenant-list-by-org", `--org-id=${UNKNOWN_DID}`]);
	});
});
