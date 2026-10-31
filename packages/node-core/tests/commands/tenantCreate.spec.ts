// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { CLIUtils } from "@3sixty/cli-core";
import { Converter } from "@3sixty/core";
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

	test.skipIf(!tenantEnabled)("creates a tenant with the given id and api key", async () => {
		const organization = await context.createIdentity("organization-explicit");
		await context.execute([
			"tenant-create",
			"--tenant-id=fedcba9876543210fedcba9876543210",
			"--api-key=00112233445566778899aabbccddeeff",
			`--organization-id=${organization.did}`
		]);

		const tenants = await readStoreRecords<{ id: string; apiKey: string; organizationId: string }>(
			context.dbDir,
			"tenant"
		);
		expect(tenants.find(t => t.id === "fedcba9876543210fedcba9876543210")).toMatchObject({
			apiKey: "00112233445566778899aabbccddeeff",
			organizationId: organization.did
		});
	});

	test.skipIf(!tenantEnabled)("throws for a tenant id that is not 32 hex characters", async () => {
		const organization = await context.createIdentity("organization-bad-id");
		await expect(
			context.execute([
				"tenant-create",
				"--tenant-id=not-hex",
				`--organization-id=${organization.did}`
			])
		).rejects.toThrow();
	});
});
