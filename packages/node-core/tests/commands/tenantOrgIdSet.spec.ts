// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import {
	readStoreRecords,
	setupCliTestContext,
	TENANT_MODES,
	UNKNOWN_TENANT_ID
} from "./cliTestHelper.js";

describe.each(TENANT_MODES)("tenant-org-id-set in $mode mode", ({ mode, tenantEnabled }) => {
	const context = setupCliTestContext("tenant-org-id-set", mode, tenantEnabled);

	/**
	 * Read the organization ID of the bootstrap tenant.
	 * @returns The organization ID.
	 */
	async function readTenantOrganizationId(): Promise<string | undefined> {
		const tenants = await readStoreRecords<{ id: string; organizationId: string }>(
			context.dbDir,
			"tenant"
		);
		return tenants.find(t => t.id === context.tenantId)?.organizationId;
	}

	test("sets and updates the tenant organization ID", async () => {
		const organization = await context.createIdentity("organization");
		await context.expectMultiTenantOnly([
			"tenant-org-id-set",
			`--tenant-id=${context.tenantId ?? UNKNOWN_TENANT_ID}`,
			`--organization-id=${organization.did}`
		]);

		if (tenantEnabled) {
			expect(await readTenantOrganizationId()).toEqual(organization.did);

			await context.execute([
				"tenant-org-id-set",
				`--tenant-id=${context.tenantId}`,
				`--organization-id=${context.organizationId}`
			]);
			expect(await readTenantOrganizationId()).toEqual(context.organizationId);
		}
	});

	test("set-tenant-org-id alias still works", async () => {
		await context.expectMultiTenantOnly([
			"set-tenant-org-id",
			`--tenant-id=${context.tenantId ?? UNKNOWN_TENANT_ID}`,
			`--organization-id=${context.organizationId}`
		]);

		if (tenantEnabled) {
			expect(await readTenantOrganizationId()).toEqual(context.organizationId);
		}
	});
});
