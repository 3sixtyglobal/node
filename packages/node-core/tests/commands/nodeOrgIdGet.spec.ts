// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { setupCliTestContext, TENANT_MODES } from "./cliTestHelper.js";

describe.each(TENANT_MODES)("node-org-id-get in $mode mode", ({ mode, tenantEnabled }) => {
	const context = setupCliTestContext("node-org-id-get", mode, tenantEnabled);

	test.skipIf(tenantEnabled)("returns the node organization ID", async () => {
		const state = await context.execute(["node-org-id-get"]);
		expect(state.nodeOrganizationId).toEqual(context.organizationId);
	});

	test.skipIf(tenantEnabled)("throws when organization ID is not set", async () => {
		await expect(
			context.execute(["node-org-id-get"], undefined, { nodeId: context.state.nodeId })
		).rejects.toThrow("nodeOrganizationIdNotSet");
	});

	test.skipIf(!tenantEnabled)("throws in multi-tenant mode", async () => {
		await expect(context.execute(["node-org-id-get"])).rejects.toThrow(
			"notAvailableInMultiTenantMode"
		);
	});
});
