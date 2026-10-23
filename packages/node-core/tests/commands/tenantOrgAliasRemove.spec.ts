// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { writeFile } from "node:fs/promises";
import { CLIDisplay } from "@3sixty/cli-core";
import {
	readStoreRecords,
	setupCliTestContext,
	TENANT_MODES,
	UNKNOWN_TENANT_ID
} from "./cliTestHelper.js";

interface ITenantRecord {
	id: string;
	organizationId: string;
	organizationIdLegacy?: string[];
}

describe.each(TENANT_MODES)("tenant-org-alias-remove in $mode mode", ({ mode, tenantEnabled }) => {
	const context = setupCliTestContext("tenant-org-alias-remove", mode, tenantEnabled);

	/**
	 * Legacy org ID management is a backend concern, so set up the legacy list directly.
	 * @param alias The alias to add to the legacy list of the bootstrap tenant.
	 */
	async function addLegacyAlias(alias: string): Promise<void> {
		const tenants = await readStoreRecords<ITenantRecord>(context.dbDir, "tenant");
		const tenant = tenants.find(t => t.id === context.tenantId);
		if (tenant) {
			tenant.organizationIdLegacy = [alias];
		}
		await writeFile(`${context.dbDir}/tenant/store.json`, JSON.stringify(tenants, undefined, "\t"));
	}

	test("removes an alias from the tenant organization legacy list", async () => {
		const alias = context.state.nodeId ?? "";

		if (tenantEnabled) {
			await addLegacyAlias(alias);
		}

		await context.expectMultiTenantOnly([
			"tenant-org-alias-remove",
			`--tenant-id=${context.tenantId ?? UNKNOWN_TENANT_ID}`,
			`--alias=${alias}`
		]);

		if (tenantEnabled) {
			const tenants = await readStoreRecords<ITenantRecord>(context.dbDir, "tenant");
			const tenant = tenants.find(t => t.id === context.tenantId);
			expect(tenant?.organizationIdLegacy).toBeUndefined();
			expect(tenant?.organizationId).toEqual(context.organizationId);
		}
	});

	test.skipIf(!tenantEnabled)(
		"remove-tenant-org-alias alias still works and warns it is deprecated",
		async () => {
			const alias = context.state.nodeId ?? "";
			await addLegacyAlias(alias);

			const warnings: string[] = [];
			const originalWarning = CLIDisplay.warning;
			CLIDisplay.warning = (label: string) => {
				warnings.push(label);
			};
			try {
				await context.execute([
					"remove-tenant-org-alias",
					`--tenant-id=${context.tenantId}`,
					`--alias=${alias}`
				]);
			} finally {
				CLIDisplay.warning = originalWarning;
			}

			expect(
				warnings.some(
					w => w.includes("remove-tenant-org-alias") && w.includes("tenant-org-alias-remove")
				)
			).toEqual(true);
			const tenants = await readStoreRecords<ITenantRecord>(context.dbDir, "tenant");
			expect(tenants.find(t => t.id === context.tenantId)?.organizationIdLegacy).toBeUndefined();
		}
	);

	test.skipIf(!tenantEnabled)("throws when alias is not found", async () => {
		await expect(
			context.execute([
				"tenant-org-alias-remove",
				`--tenant-id=${context.tenantId}`,
				`--alias=${context.state.nodeId}`
			])
		).rejects.toThrow("aliasNotFound");
	});
});
