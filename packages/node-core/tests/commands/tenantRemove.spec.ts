// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { CLIUtils } from "@twin.org/cli-core";
import {
	readStoreRecords,
	setupCliTestContext,
	TENANT_ADMIN_NOT_REGISTERED,
	TENANT_MODES,
	UNKNOWN_TENANT_ID
} from "./cliTestHelper.js";

describe.each(TENANT_MODES)("tenant-remove in $mode mode", ({ mode, tenantEnabled }) => {
	const context = setupCliTestContext("tenant-remove", mode, tenantEnabled);

	test("removes a tenant", async () => {
		let tenantId = UNKNOWN_TENANT_ID;
		if (tenantEnabled) {
			const organization = await context.createIdentity("organization");
			await context.execute([
				"tenant-create",
				`--organization-id=${organization.did}`,
				`--output-json=${context.dir}tenant.json`
			]);
			const json = await CLIUtils.readJsonFile<{ tenantId: string }>(`${context.dir}tenant.json`);
			tenantId = json?.tenantId ?? "";
		}

		await context.expectMultiTenantOnly(["tenant-remove", `--tenant-id=${tenantId}`]);

		if (tenantEnabled) {
			const tenants = await readStoreRecords<{ id: string }>(context.dbDir, "tenant");
			expect(tenants.map(t => t.id)).toEqual([context.tenantId]);
		}
	});

	test("throws when the tenant does not exist", async () => {
		await expect(
			context.execute(["tenant-remove", `--tenant-id=${UNKNOWN_TENANT_ID}`])
		).rejects.toThrow(tenantEnabled ? "tenantAdminService" : TENANT_ADMIN_NOT_REGISTERED);
	});
});
