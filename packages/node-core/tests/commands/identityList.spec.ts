// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { readStoreRecords, setupCliTestContext, TENANT_MODES } from "./cliTestHelper.js";

describe.each(TENANT_MODES)("identity-list in $mode mode", ({ mode, tenantEnabled }) => {
	const context = setupCliTestContext("identity-list", mode, tenantEnabled);

	test("returns all identities in custody", async () => {
		await context.execute(["identity-list"]);

		const documents = await readStoreRecords<{ id: string }>(context.dbDir, "identity-document");
		expect(documents.some(d => d.id === context.state.nodeId)).toEqual(true);
	});
});
