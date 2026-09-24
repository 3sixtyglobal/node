// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { Converter, RandomHelper } from "@twin.org/core";
import { readStoreRecords, setupCliTestContext, TENANT_MODES } from "./cliTestHelper.js";

describe.each(TENANT_MODES)("tenant-import in $mode mode", ({ mode, tenantEnabled }) => {
	const context = setupCliTestContext("tenant-import", mode, tenantEnabled);

	test("imports a tenant", async () => {
		const organization = await context.createIdentity("organization");
		const tenantId = Converter.bytesToHex(RandomHelper.generate(16));
		const apiKey = Converter.bytesToHex(RandomHelper.generate(16));

		await context.expectMultiTenantOnly([
			"tenant-import",
			`--tenant-id=${tenantId}`,
			`--api-key=${apiKey}`,
			`--organization-id=${organization.did}`,
			"--label=imported",
			"--public-origin=https://api.example.com:1234"
		]);

		if (tenantEnabled) {
			const tenants = await readStoreRecords<{ id: string; apiKey: string; label: string }>(
				context.dbDir,
				"tenant"
			);
			const tenant = tenants.find(t => t.id === tenantId);
			expect(tenant?.apiKey).toEqual(apiKey);
			expect(tenant?.label).toEqual("imported");
		}
	});
});
