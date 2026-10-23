// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import {
	readStoreRecords,
	setupCliTestContext,
	TENANT_MODES,
	UNKNOWN_TENANT_ID
} from "./cliTestHelper.js";

describe.each(TENANT_MODES)("tenant-update in $mode mode", ({ mode, tenantEnabled }) => {
	const context = setupCliTestContext("tenant-update", mode, tenantEnabled);

	test("updates the tenant", async () => {
		await context.expectMultiTenantOnly([
			"tenant-update",
			`--tenant-id=${context.tenantId ?? UNKNOWN_TENANT_ID}`,
			"--label=updated-node",
			"--public-origin=https://api.updated.com:5678"
		]);

		if (tenantEnabled) {
			const tenants = await readStoreRecords<{ id: string; label: string; publicOrigin: string }>(
				context.dbDir,
				"tenant"
			);
			const tenant = tenants.find(t => t.id === context.tenantId);
			expect(tenant?.label).toEqual("updated-node");
			expect(tenant?.publicOrigin).toEqual("https://api.updated.com:5678");
		}
	});
});
