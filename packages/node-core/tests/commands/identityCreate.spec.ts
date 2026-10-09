// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { CLIUtils } from "@3sixty/cli-core";
import {
	readStoreRecords,
	setupCliTestContext,
	TENANT_ADMIN_NOT_REGISTERED,
	TENANT_MODES,
	valueFromEnv
} from "./cliTestHelper.js";

describe.each(TENANT_MODES)("identity-create in $mode mode", ({ mode, tenantEnabled }) => {
	const context = setupCliTestContext("identity-create", mode, tenantEnabled);

	test("creates an identity with a funded wallet", async () => {
		await context.execute([
			"identity-create",
			"--fund-wallet=true",
			`--output-json=${context.dir}funded.json`,
			`--output-env=${context.dir}funded.env`,
			"--output-env-prefix=funded"
		]);

		const json = await CLIUtils.readJsonFile<{
			mnemonic: string;
			did: string;
			walletAddress: string;
		}>(`${context.dir}funded.json`);
		const env = await CLIUtils.readLinesFile(`${context.dir}funded.env`);
		expect(json?.mnemonic).toEqual(valueFromEnv(env?.[0]));
		expect(json?.did).toEqual(valueFromEnv(env?.[1]));
		expect(json?.walletAddress).toEqual(valueFromEnv(env?.[2]));
	});

	test("creates an identity with a controller and no wallet", async () => {
		await context.execute([
			"identity-create",
			`--controller=${context.state.nodeId}`,
			`--output-json=${context.dir}controlled.json`,
			`--output-env=${context.dir}controlled.env`,
			"--output-env-prefix=user"
		]);

		const json = await CLIUtils.readJsonFile<{
			mnemonic: string;
			did: string;
			walletAddress?: string;
		}>(`${context.dir}controlled.json`);
		const env = await CLIUtils.readLinesFile(`${context.dir}controlled.env`);
		expect(json?.mnemonic).toEqual(valueFromEnv(env?.[0]));
		expect(json?.did).toEqual(valueFromEnv(env?.[1]));
		expect(json?.walletAddress).toBeUndefined();

		const documents = await readStoreRecords<{ id: string }>(context.dbDir, "identity-document");
		expect(documents.some(d => d.id === json?.did)).toEqual(true);
	});

	test("with --node-organization-id sets the node organization ID", async () => {
		const args = [
			"identity-create",
			"--node-organization-id=true",
			`--output-json=${context.dir}node-organization.json`
		];
		if (tenantEnabled) {
			await expect(context.execute(args)).rejects.toThrow(
				"nodeOrganizationIdNotAvailableInMultiTenantMode"
			);
		} else {
			const state = await context.execute(args, undefined, { nodeId: context.state.nodeId });
			const json = await CLIUtils.readJsonFile<{ did: string }>(
				`${context.dir}node-organization.json`
			);
			expect(state.nodeOrganizationId).toEqual(json?.did);
		}
	});

	test("with --tenant-organization-id sets the tenant organization ID", async () => {
		const args = [
			"identity-create",
			`--tenant-organization-id=${context.tenantId ?? "0123456789abcdef0123456789abcdef"}`,
			`--output-json=${context.dir}tenant-organization.json`
		];
		if (tenantEnabled) {
			await context.execute(args);
			const json = await CLIUtils.readJsonFile<{ did: string }>(
				`${context.dir}tenant-organization.json`
			);
			const tenants = await readStoreRecords<{ id: string; organizationId: string }>(
				context.dbDir,
				"tenant"
			);
			expect(tenants.find(t => t.id === context.tenantId)?.organizationId).toEqual(json?.did);
		} else {
			await expect(context.execute(args)).rejects.toThrow(TENANT_ADMIN_NOT_REGISTERED);
		}
	});

	test("throws when more than one assignment option is set", async () => {
		await expect(
			context.execute(["identity-create", "--node-id=true", "--node-organization-id=true"])
		).rejects.toThrow("onlyOneAssignmentOptionAllowed");
	});

	test("throws when the mnemonic is invalid", async () => {
		await expect(
			context.execute(["identity-create", "--mnemonic=not a valid mnemonic"])
		).rejects.toThrow("invalidMnemonic");
	});
});
