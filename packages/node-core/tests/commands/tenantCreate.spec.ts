// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { CLIUtils } from "@twin.org/cli-core";
import { Converter } from "@twin.org/core";
import {
	readStoreRecords,
	setupCliTestContext,
	TENANT_MODES,
	valueFromEnv
} from "./cliTestHelper.js";

describe.each(TENANT_MODES)("tenant-create in $mode mode", ({ mode, tenantEnabled }) => {
	const context = setupCliTestContext("tenant-create", mode, tenantEnabled);

	test("creates a tenant", async () => {
		const organization = await context.createIdentity("organization");
		await context.expectMultiTenantOnly([
			"tenant-create",
			`--organization-id=${organization.did}`,
			"--label=node",
			"--public-origin=https://api.example.com:1234",
			`--output-json=${context.dir}tenant.json`,
			`--output-env=${context.dir}tenant.env`,
			"--output-env-prefix=node"
		]);

		if (tenantEnabled) {
			const json = await CLIUtils.readJsonFile<{
				apiKey: string;
				tenantId: string;
				organizationId: string;
				label: string;
				publicOrigin: string;
			}>(`${context.dir}tenant.json`);
			const env = await CLIUtils.readLinesFile(`${context.dir}tenant.env`);
			expect(json?.apiKey).toEqual(valueFromEnv(env?.[0]));
			expect(json?.tenantId).toEqual(valueFromEnv(env?.[1]));
			expect(json?.organizationId).toEqual(valueFromEnv(env?.[2]));
			expect(json?.label).toEqual(valueFromEnv(env?.[3]));
			expect(json?.publicOrigin).toEqual(valueFromEnv(env?.[4]));

			const tenants = await readStoreRecords<{
				id: string;
				label: string;
				publicOrigin: string;
				partitionId: string;
			}>(context.dbDir, "tenant");
			const tenant = tenants.find(t => t.id === json?.tenantId);
			expect(tenant?.label).toEqual("node");
			expect(tenant?.publicOrigin).toEqual("https://api.example.com:1234");

			const nodeIdParts = (context.state.nodeId ?? "").split(":");
			expect(tenant?.partitionId).toEqual(
				Converter.bytesToBase64Url(Converter.hexToBytes(nodeIdParts[2]))
			);
		}
	});

	test.skipIf(!tenantEnabled)("throws when the organization already has a tenant", async () => {
		await expect(
			context.execute(["tenant-create", `--organization-id=${context.organizationId}`])
		).rejects.toThrow("organizationIdAlreadyExists");
	});
});
