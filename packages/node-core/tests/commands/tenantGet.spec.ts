// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { setupCliTestContext, TENANT_MODES, UNKNOWN_TENANT_ID } from "./cliTestHelper.js";

describe.each(TENANT_MODES)("tenant-get in $mode mode", ({ mode, tenantEnabled }) => {
	const context = setupCliTestContext("tenant-get", mode, tenantEnabled);

	test("returns the full tenant record", async () => {
		await context.expectMultiTenantOnly([
			"tenant-get",
			`--tenant-id=${context.tenantId ?? UNKNOWN_TENANT_ID}`
		]);
	});

	test.skipIf(!tenantEnabled)("throws when tenant is not found", async () => {
		await expect(
			context.execute(["tenant-get", `--tenant-id=${UNKNOWN_TENANT_ID}`])
		).rejects.toThrow();
	});
});
