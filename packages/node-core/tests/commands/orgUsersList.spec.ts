// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import {
	readStoreRecords,
	setupCliTestContext,
	TENANT_MODES,
	UNKNOWN_DID
} from "./cliTestHelper.js";

describe.each(TENANT_MODES)("org-users-list in $mode mode", ({ mode, tenantEnabled }) => {
	const context = setupCliTestContext("org-users-list", mode, tenantEnabled);

	test("returns users for the given org", async () => {
		await context.execute(["org-users-list", `--org-did=${context.organizationId}`]);

		const users = await readStoreRecords<{ organization: string }>(
			context.dbDir,
			"authentication-user"
		);
		expect(users.filter(u => u.organization === context.organizationId).length).toEqual(1);
	});

	test("returns empty list for org with no users", async () => {
		await context.execute(["org-users-list", `--org-did=${UNKNOWN_DID}`]);
	});

	test("uses the node organization when no org is given", async () => {
		if (tenantEnabled) {
			await expect(context.execute(["org-users-list"])).rejects.toThrow("orgDidRequired");
		} else {
			await context.execute(["org-users-list"]);
		}
	});
});
