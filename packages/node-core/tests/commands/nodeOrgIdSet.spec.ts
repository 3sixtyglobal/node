// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { setupCliTestContext, TENANT_MODES } from "./cliTestHelper.js";

describe.each(TENANT_MODES)("node-org-id-set in $mode mode", ({ mode, tenantEnabled }) => {
	const context = setupCliTestContext("node-org-id-set", mode, tenantEnabled);

	test.skipIf(tenantEnabled)("sets the node organization ID", async () => {
		const identity = await context.createIdentity("organization");
		const state = await context.execute(
			["node-org-id-set", `--organization-id=${identity.did}`],
			undefined,
			{}
		);
		expect(state.nodeOrganizationId).toEqual(identity.did);
	});

	test.skipIf(tenantEnabled)("set-node-org-id alias still works", async () => {
		const identity = await context.createIdentity("organization-alias");
		const state = await context.execute(
			["set-node-org-id", `--organization-id=${identity.did}`],
			undefined,
			{}
		);
		expect(state.nodeOrganizationId).toEqual(identity.did);
	});

	test.skipIf(!tenantEnabled)("throws in multi-tenant mode", async () => {
		await expect(
			context.execute(["node-org-id-set", `--organization-id=${context.organizationId}`])
		).rejects.toThrow("notAvailableInMultiTenantMode");
	});
});
