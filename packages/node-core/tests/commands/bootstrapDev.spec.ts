// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { rm } from "node:fs/promises";
import { CLIDisplay } from "@3sixty/cli-core";
import { Factory } from "@3sixty/core";
import { executeCliCommand, OUTPUT_TMP_DIR, readStoreRecords } from "./cliTestHelper.js";
import type { INodeEngineState } from "../../src/models/INodeEngineState.js";

const BOOTSTRAP_DIR = `${OUTPUT_TMP_DIR}bootstrap-dev/`;

// Canonical BIP39 24-word test vectors - deterministic key derivation
const TEST_NODE_MNEMONIC =
	"abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art";
const TEST_ORG_MNEMONIC =
	"legal winner thank year wave sausage worth useful legal winner thank year wave sausage worth useful legal winner thank year wave sausage worth title";
const TEST_ADMIN_MNEMONIC =
	"letter advice cage absurd amount doctor acoustic avoid letter advice cage absurd amount doctor acoustic avoid letter advice cage absurd amount doctor acoustic bless";

/**
 * Execute bootstrap-dev, multi-tenant unless TWIN_TENANT_ENABLED is "false".
 * @param args The CLI args.
 * @param state The node state.
 * @param envVars Additional environment variables.
 * @returns The state after the command.
 */
async function executeBootstrap(
	args: string[],
	state: INodeEngineState,
	envVars?: { [key: string]: string }
): Promise<INodeEngineState> {
	const { TWIN_TENANT_ENABLED, TWIN_STORAGE_FILE_ROOT, ...otherEnvVars } = envVars ?? {};
	return executeCliCommand(args, {
		state,
		dbDir: TWIN_STORAGE_FILE_ROOT ?? `${BOOTSTRAP_DIR}db`,
		tenantEnabled: TWIN_TENANT_ENABLED !== "false",
		envVars: otherEnvVars
	});
}

describe("bootstrap-dev", () => {
	beforeAll(async () => {
		await rm(BOOTSTRAP_DIR, { recursive: true, force: true });
	});

	beforeEach(() => {
		Factory.clearFactories();
	});

	test("Can bootstrap in dev mode", async () => {
		await executeBootstrap(
			["bootstrap-dev"],
			{},
			{
				TWIN_FEATURES: "wallet,admin-user"
			}
		);
	});

	test("bootstrap-legacy alias resolves to bootstrap-dev and emits a deprecation warning", async () => {
		const aliasDir = `${BOOTSTRAP_DIR}bootstrap-alias/`;
		await rm(aliasDir, { recursive: true, force: true });

		const warnings: string[] = [];
		const originalWarning = CLIDisplay.warning;
		CLIDisplay.warning = (label: string) => {
			warnings.push(label);
		};
		try {
			await executeBootstrap(
				["bootstrap-legacy"],
				{},
				{
					TWIN_FEATURES: "wallet,admin-user",
					TWIN_STORAGE_FILE_ROOT: `${aliasDir}db`
				}
			);
		} finally {
			CLIDisplay.warning = originalWarning;
		}
		expect(warnings.some(w => w.includes("bootstrap-legacy") && w.includes("bootstrap-dev"))).toBe(
			true
		);
	});

	test("bootstrap-dev is idempotent with multi-tenancy when TENANT_ID is not set", async () => {
		const bootstrapDir = `${BOOTSTRAP_DIR}bootstrap-idempotent/`;
		const dbDir = `${bootstrapDir}db`;
		await rm(bootstrapDir, { recursive: true, force: true });

		const runBootstrap = async (state: INodeEngineState): Promise<INodeEngineState> =>
			executeBootstrap(["bootstrap-dev"], state, {
				TWIN_FEATURES: "wallet,admin-user",
				TWIN_STORAGE_FILE_ROOT: dbDir
			});

		const stateAfterFirst = await runBootstrap({});
		expect(stateAfterFirst.nodeId).toBeDefined();
		expect(stateAfterFirst.nodeOrganizationId).toBeUndefined();
		const tenantsAfterFirst = await readStoreRecords(dbDir, "tenant");
		const authUsersAfterFirst = await readStoreRecords(dbDir, "authentication-user");
		const identityDocsAfterFirst = await readStoreRecords(dbDir, "identity-document");
		const identityProfilesAfterFirst = await readStoreRecords(dbDir, "identity-profile");

		const stateAfterSecond = await runBootstrap(stateAfterFirst);
		expect(stateAfterSecond.nodeId).toEqual(stateAfterFirst.nodeId);
		expect(stateAfterSecond.nodeOrganizationId).toBeUndefined();
		expect(await readStoreRecords(dbDir, "tenant")).toEqual(tenantsAfterFirst);
		expect(await readStoreRecords(dbDir, "authentication-user")).toEqual(authUsersAfterFirst);
		expect(await readStoreRecords(dbDir, "identity-document")).toEqual(identityDocsAfterFirst);
		expect(await readStoreRecords(dbDir, "identity-profile")).toEqual(identityProfilesAfterFirst);

		const stateAfterThird = await runBootstrap(stateAfterSecond);
		expect(stateAfterThird.nodeId).toEqual(stateAfterFirst.nodeId);
		expect(stateAfterThird.nodeOrganizationId).toBeUndefined();
		expect(await readStoreRecords(dbDir, "tenant")).toEqual(tenantsAfterFirst);
		expect(await readStoreRecords(dbDir, "authentication-user")).toEqual(authUsersAfterFirst);
		expect(await readStoreRecords(dbDir, "identity-document")).toEqual(identityDocsAfterFirst);
		expect(await readStoreRecords(dbDir, "identity-profile")).toEqual(identityProfilesAfterFirst);
	});

	test("bootstrap-dev is idempotent in single-tenant mode with wallet and admin-user features", async () => {
		const bootstrapDir = `${BOOTSTRAP_DIR}bootstrap-idempotent-single/`;
		const dbDir = `${bootstrapDir}db`;
		await rm(bootstrapDir, { recursive: true, force: true });

		const runBootstrap = async (state: INodeEngineState): Promise<INodeEngineState> =>
			executeBootstrap(["bootstrap-dev"], state, {
				TWIN_TENANT_ENABLED: "false",
				TWIN_FEATURES: "wallet,admin-user",
				TWIN_STORAGE_FILE_ROOT: dbDir
			});

		const stateAfterFirst = await runBootstrap({});
		expect(stateAfterFirst.nodeId).toBeDefined();
		expect(stateAfterFirst.nodeOrganizationId).toBeDefined();
		const tenantsAfterFirst = await readStoreRecords(dbDir, "tenant");
		const authUsersAfterFirst = await readStoreRecords(dbDir, "authentication-user");
		const identityDocsAfterFirst = await readStoreRecords(dbDir, "identity-document");
		const identityProfilesAfterFirst = await readStoreRecords(dbDir, "identity-profile");

		const stateAfterSecond = await runBootstrap(stateAfterFirst);
		expect(stateAfterSecond.nodeId).toEqual(stateAfterFirst.nodeId);
		expect(stateAfterSecond.nodeOrganizationId).toEqual(stateAfterFirst.nodeOrganizationId);
		expect(await readStoreRecords(dbDir, "tenant")).toEqual(tenantsAfterFirst);
		expect(await readStoreRecords(dbDir, "authentication-user")).toEqual(authUsersAfterFirst);
		expect(await readStoreRecords(dbDir, "identity-document")).toEqual(identityDocsAfterFirst);
		expect(await readStoreRecords(dbDir, "identity-profile")).toEqual(identityProfilesAfterFirst);

		const stateAfterThird = await runBootstrap(stateAfterSecond);
		expect(stateAfterThird.nodeId).toEqual(stateAfterFirst.nodeId);
		expect(stateAfterThird.nodeOrganizationId).toEqual(stateAfterFirst.nodeOrganizationId);
		expect(await readStoreRecords(dbDir, "tenant")).toEqual(tenantsAfterFirst);
		expect(await readStoreRecords(dbDir, "authentication-user")).toEqual(authUsersAfterFirst);
		expect(await readStoreRecords(dbDir, "identity-document")).toEqual(identityDocsAfterFirst);
		expect(await readStoreRecords(dbDir, "identity-profile")).toEqual(identityProfilesAfterFirst);
	});

	test("bootstrap-dev is idempotent in single-tenant mode with wallet feature only", async () => {
		const bootstrapDir = `${BOOTSTRAP_DIR}bootstrap-idempotent-single-wallet/`;
		const dbDir = `${bootstrapDir}db`;
		await rm(bootstrapDir, { recursive: true, force: true });

		const runBootstrap = async (state: INodeEngineState): Promise<INodeEngineState> =>
			executeBootstrap(["bootstrap-dev"], state, {
				TWIN_TENANT_ENABLED: "false",
				TWIN_FEATURES: "wallet",
				TWIN_STORAGE_FILE_ROOT: dbDir
			});

		const stateAfterFirst = await runBootstrap({});
		expect(stateAfterFirst.nodeId).toBeDefined();
		expect(stateAfterFirst.nodeOrganizationId).toBeDefined();
		const tenantsAfterFirst = await readStoreRecords(dbDir, "tenant");
		const authUsersAfterFirst = await readStoreRecords(dbDir, "authentication-user");
		const identityDocsAfterFirst = await readStoreRecords(dbDir, "identity-document");

		const stateAfterSecond = await runBootstrap(stateAfterFirst);
		expect(stateAfterSecond.nodeId).toEqual(stateAfterFirst.nodeId);
		expect(stateAfterSecond.nodeOrganizationId).toEqual(stateAfterFirst.nodeOrganizationId);
		expect(await readStoreRecords(dbDir, "tenant")).toEqual(tenantsAfterFirst);
		expect(await readStoreRecords(dbDir, "authentication-user")).toEqual(authUsersAfterFirst);
		expect(await readStoreRecords(dbDir, "identity-document")).toEqual(identityDocsAfterFirst);

		const stateAfterThird = await runBootstrap(stateAfterSecond);
		expect(stateAfterThird.nodeId).toEqual(stateAfterFirst.nodeId);
		expect(stateAfterThird.nodeOrganizationId).toEqual(stateAfterFirst.nodeOrganizationId);
		expect(await readStoreRecords(dbDir, "tenant")).toEqual(tenantsAfterFirst);
		expect(await readStoreRecords(dbDir, "authentication-user")).toEqual(authUsersAfterFirst);
		expect(await readStoreRecords(dbDir, "identity-document")).toEqual(identityDocsAfterFirst);
	});

	test("bootstrap-dev multi-tenant: explicit tenant config propagates to DB and is retained on re-run without env vars", async () => {
		const bootstrapDir = `${BOOTSTRAP_DIR}bootstrap-propagate-multi/`;
		const dbDir = `${bootstrapDir}db`;
		await rm(bootstrapDir, { recursive: true, force: true });

		// First run: configure with explicit tenant ID and API key
		const stateAfterFirst = await executeBootstrap(
			["bootstrap-dev"],
			{},
			{
				TWIN_FEATURES: "wallet,admin-user",
				TWIN_STORAGE_FILE_ROOT: dbDir,
				TWIN_TENANT_ID: "019eba0000000000000000000000cafe",
				TWIN_TENANT_API_KEY: "019eba0000000000000000000000babe"
			}
		);
		expect(stateAfterFirst.nodeId).toBeDefined();
		expect(stateAfterFirst.nodeOrganizationId).toBeUndefined();

		// Verify tenant record contains the explicitly configured values
		interface TenantRecord {
			id: string;
			apiKey: string;
			label: string;
			organizationId: string;
		}
		const tenants = await readStoreRecords<TenantRecord>(dbDir, "tenant");
		expect(tenants).toHaveLength(1);
		expect(tenants[0].id).toBe("019eba0000000000000000000000cafe");
		expect(tenants[0].apiKey).toBe("019eba0000000000000000000000babe");
		expect(tenants[0].label).toBe("Tenant");

		// Verify admin user record contains expected values for multi-tenant mode
		interface AuthUserRecord {
			email: string;
			scope: string;
			identity: string;
			organization: string;
		}
		const authUsers = await readStoreRecords<AuthUserRecord>(dbDir, "authentication-user");
		expect(authUsers).toHaveLength(1);
		expect(authUsers[0].email).toBe("admin@tenant");
		expect(authUsers[0].scope).toBe("global-admin,tenant-admin,user-admin");

		// Verify identity documents include the node DID
		interface IdentityDocRecord {
			id: string;
		}
		const identityDocs = await readStoreRecords<IdentityDocRecord>(dbDir, "identity-document");
		expect(identityDocs.some(doc => doc.id === stateAfterFirst.nodeId)).toBe(true);
		const identityProfiles = await readStoreRecords(dbDir, "identity-profile");

		// Second run: no explicit tenant env vars - lookup by label must find the existing tenant
		const stateAfterSecond = await executeBootstrap(["bootstrap-dev"], stateAfterFirst, {
			TWIN_FEATURES: "wallet,admin-user",
			TWIN_STORAGE_FILE_ROOT: dbDir
		});
		expect(stateAfterSecond.nodeId).toEqual(stateAfterFirst.nodeId);

		// All DB records must be byte-for-byte identical - nothing recreated or mutated
		expect(await readStoreRecords(dbDir, "tenant")).toEqual(tenants);
		expect(await readStoreRecords(dbDir, "authentication-user")).toEqual(authUsers);
		expect(await readStoreRecords(dbDir, "identity-document")).toEqual(identityDocs);
		expect(await readStoreRecords(dbDir, "identity-profile")).toEqual(identityProfiles);
	});

	test("bootstrap-dev single-tenant: admin user config propagates to DB and is retained on re-run without env vars", async () => {
		const bootstrapDir = `${BOOTSTRAP_DIR}bootstrap-propagate-single/`;
		const dbDir = `${bootstrapDir}db`;
		await rm(bootstrapDir, { recursive: true, force: true });

		// First run: no explicit admin user env vars - defaults apply
		const stateAfterFirst = await executeBootstrap(
			["bootstrap-dev"],
			{},
			{
				TWIN_TENANT_ENABLED: "false",
				TWIN_FEATURES: "wallet,admin-user",
				TWIN_STORAGE_FILE_ROOT: dbDir
			}
		);
		expect(stateAfterFirst.nodeId).toBeDefined();
		expect(stateAfterFirst.nodeOrganizationId).toBeDefined();

		// Verify admin user record contains expected values for single-tenant mode
		interface AuthUserRecord {
			email: string;
			scope: string;
		}
		const authUsers = await readStoreRecords<AuthUserRecord>(dbDir, "authentication-user");
		expect(authUsers).toHaveLength(1);
		expect(authUsers[0].email).toBe("admin@node");
		expect(authUsers[0].scope).toBe("global-admin,user-admin");

		// Verify identity documents contain both node and org DIDs stored in state
		interface IdentityDocRecord {
			id: string;
		}
		const identityDocs = await readStoreRecords<IdentityDocRecord>(dbDir, "identity-document");
		expect(identityDocs.some(doc => doc.id === stateAfterFirst.nodeId)).toBe(true);
		expect(identityDocs.some(doc => doc.id === stateAfterFirst.nodeOrganizationId)).toBe(true);

		// Verify identity profile reflects single-tenant defaults
		interface IdentityProfileRecord {
			privateProfile: { givenName: string; familyName: string; email: string };
		}
		const identityProfiles = await readStoreRecords<IdentityProfileRecord>(
			dbDir,
			"identity-profile"
		);
		expect(identityProfiles).toHaveLength(1);
		expect(identityProfiles[0].privateProfile.givenName).toBe("Node");
		expect(identityProfiles[0].privateProfile.familyName).toBe("Admin");
		expect(identityProfiles[0].privateProfile.email).toBe("admin@node");

		// Second run: same config, no extra env vars
		const stateAfterSecond = await executeBootstrap(["bootstrap-dev"], stateAfterFirst, {
			TWIN_TENANT_ENABLED: "false",
			TWIN_FEATURES: "wallet,admin-user",
			TWIN_STORAGE_FILE_ROOT: dbDir
		});
		expect(stateAfterSecond.nodeId).toEqual(stateAfterFirst.nodeId);
		expect(stateAfterSecond.nodeOrganizationId).toEqual(stateAfterFirst.nodeOrganizationId);

		// All DB records must be byte-for-byte identical - nothing recreated or mutated
		expect(await readStoreRecords(dbDir, "authentication-user")).toEqual(authUsers);
		expect(await readStoreRecords(dbDir, "identity-document")).toEqual(identityDocs);
		expect(await readStoreRecords(dbDir, "identity-profile")).toEqual(identityProfiles);
	});

	test("bootstrap-dev single-tenant: explicit node and org mnemonics are accepted and retained on re-run without mnemonics", async () => {
		const bootstrapDir = `${BOOTSTRAP_DIR}bootstrap-mnemonic-single/`;
		const dbDir = `${bootstrapDir}db`;
		await rm(bootstrapDir, { recursive: true, force: true });

		// Run 1: specify mnemonics explicitly
		const stateAfterFirst = await executeBootstrap(
			["bootstrap-dev"],
			{},
			{
				TWIN_TENANT_ENABLED: "false",
				TWIN_FEATURES: "wallet,admin-user",
				TWIN_STORAGE_FILE_ROOT: dbDir,
				TWIN_NODE_MNEMONIC: TEST_NODE_MNEMONIC,
				TWIN_ORGANIZATION_MNEMONIC: TEST_ORG_MNEMONIC
			}
		);
		expect(stateAfterFirst.nodeId).toBeDefined();
		expect(stateAfterFirst.nodeOrganizationId).toBeDefined();

		// Snapshot DB state after run 1
		const identityDocs = await readStoreRecords(dbDir, "identity-document");
		expect(identityDocs.some(doc => (doc as { id: string }).id === stateAfterFirst.nodeId)).toBe(
			true
		);
		const authUsers = await readStoreRecords(dbDir, "authentication-user");
		const identityProfiles = await readStoreRecords(dbDir, "identity-profile");

		// Run 2: no mnemonics - vault already holds them, identities already exist
		const stateAfterSecond = await executeBootstrap(["bootstrap-dev"], stateAfterFirst, {
			TWIN_TENANT_ENABLED: "false",
			TWIN_FEATURES: "wallet,admin-user",
			TWIN_STORAGE_FILE_ROOT: dbDir
		});
		expect(stateAfterSecond.nodeId).toEqual(stateAfterFirst.nodeId);
		expect(stateAfterSecond.nodeOrganizationId).toEqual(stateAfterFirst.nodeOrganizationId);
		expect(await readStoreRecords(dbDir, "identity-document")).toEqual(identityDocs);
		expect(await readStoreRecords(dbDir, "authentication-user")).toEqual(authUsers);
		expect(await readStoreRecords(dbDir, "identity-profile")).toEqual(identityProfiles);
	});

	test("bootstrap-dev multi-tenant: explicit node and org mnemonics are accepted and retained on re-run without mnemonics", async () => {
		const bootstrapDir = `${BOOTSTRAP_DIR}bootstrap-mnemonic-multi/`;
		const dbDir = `${bootstrapDir}db`;
		await rm(bootstrapDir, { recursive: true, force: true });

		// Run 1: specify mnemonics explicitly
		const stateAfterFirst = await executeBootstrap(
			["bootstrap-dev"],
			{},
			{
				TWIN_FEATURES: "wallet,admin-user",
				TWIN_STORAGE_FILE_ROOT: dbDir,
				TWIN_NODE_MNEMONIC: TEST_NODE_MNEMONIC,
				TWIN_ORGANIZATION_MNEMONIC: TEST_ORG_MNEMONIC
			}
		);
		expect(stateAfterFirst.nodeId).toBeDefined();
		expect(stateAfterFirst.nodeOrganizationId).toBeUndefined();

		// Snapshot DB state after run 1
		interface TenantRecord {
			organizationId: string;
		}
		const tenants = await readStoreRecords<TenantRecord>(dbDir, "tenant");
		expect(tenants).toHaveLength(1);
		const identityDocs = await readStoreRecords(dbDir, "identity-document");
		const authUsers = await readStoreRecords(dbDir, "authentication-user");
		const identityProfiles = await readStoreRecords(dbDir, "identity-profile");

		// Run 2: no mnemonics - vault already holds them, tenant and identities already exist
		const stateAfterSecond = await executeBootstrap(["bootstrap-dev"], stateAfterFirst, {
			TWIN_FEATURES: "wallet,admin-user",
			TWIN_STORAGE_FILE_ROOT: dbDir
		});
		expect(stateAfterSecond.nodeId).toEqual(stateAfterFirst.nodeId);
		expect(await readStoreRecords(dbDir, "tenant")).toEqual(tenants);
		expect(await readStoreRecords(dbDir, "identity-document")).toEqual(identityDocs);
		expect(await readStoreRecords(dbDir, "authentication-user")).toEqual(authUsers);
		expect(await readStoreRecords(dbDir, "identity-profile")).toEqual(identityProfiles);
	});

	test("bootstrap-dev single-tenant: custom admin user name and password propagate to DB and are retained on re-run without password", async () => {
		const bootstrapDir = `${BOOTSTRAP_DIR}bootstrap-admin-single/`;
		const dbDir = `${bootstrapDir}db`;
		await rm(bootstrapDir, { recursive: true, force: true });

		// Run 1: explicit admin name and password
		const stateAfterFirst = await executeBootstrap(
			["bootstrap-dev"],
			{},
			{
				TWIN_TENANT_ENABLED: "false",
				TWIN_FEATURES: "wallet,admin-user",
				TWIN_STORAGE_FILE_ROOT: dbDir,
				TWIN_ADMIN_USER_NAME: "admin@acme.com",
				TWIN_ADMIN_USER_PASSWORD: "S3curePass!1Word2"
			}
		);
		expect(stateAfterFirst.nodeId).toBeDefined();
		expect(stateAfterFirst.nodeOrganizationId).toBeDefined();

		interface AuthUserRecord {
			email: string;
			scope: string;
		}
		const authUsers = await readStoreRecords<AuthUserRecord>(dbDir, "authentication-user");
		expect(authUsers).toHaveLength(1);
		expect(authUsers[0].email).toBe("admin@acme.com");
		expect(authUsers[0].scope).toBe("global-admin,user-admin");

		interface ProfileRecord {
			privateProfile: { givenName: string; familyName: string; email: string };
		}
		const identityProfiles = await readStoreRecords<ProfileRecord>(dbDir, "identity-profile");
		expect(identityProfiles).toHaveLength(1);
		expect(identityProfiles[0].privateProfile.givenName).toBe("Node");
		expect(identityProfiles[0].privateProfile.email).toBe("admin@acme.com");

		const identityDocs = await readStoreRecords(dbDir, "identity-document");

		// Run 2: same name, no password - overwriteMode:skip must leave the record untouched
		const stateAfterSecond = await executeBootstrap(["bootstrap-dev"], stateAfterFirst, {
			TWIN_TENANT_ENABLED: "false",
			TWIN_FEATURES: "wallet,admin-user",
			TWIN_STORAGE_FILE_ROOT: dbDir,
			TWIN_ADMIN_USER_NAME: "admin@acme.com"
		});
		expect(stateAfterSecond.nodeId).toEqual(stateAfterFirst.nodeId);
		expect(stateAfterSecond.nodeOrganizationId).toEqual(stateAfterFirst.nodeOrganizationId);
		expect(await readStoreRecords(dbDir, "authentication-user")).toEqual(authUsers);
		expect(await readStoreRecords(dbDir, "identity-document")).toEqual(identityDocs);
		expect(await readStoreRecords(dbDir, "identity-profile")).toEqual(identityProfiles);
	});

	test("bootstrap-dev multi-tenant: custom admin user name and password propagate to DB and are retained on re-run without password", async () => {
		const bootstrapDir = `${BOOTSTRAP_DIR}bootstrap-admin-multi/`;
		const dbDir = `${bootstrapDir}db`;
		await rm(bootstrapDir, { recursive: true, force: true });

		const stateAfterFirst = await executeBootstrap(
			["bootstrap-dev"],
			{},
			{
				TWIN_FEATURES: "wallet,admin-user",
				TWIN_STORAGE_FILE_ROOT: dbDir,
				TWIN_ADMIN_USER_NAME: "admin@acme.com",
				TWIN_ADMIN_USER_PASSWORD: "S3curePass!1Word2"
			}
		);
		expect(stateAfterFirst.nodeId).toBeDefined();

		interface AuthUserRecord {
			email: string;
			scope: string;
		}
		const authUsers = await readStoreRecords<AuthUserRecord>(dbDir, "authentication-user");
		expect(authUsers).toHaveLength(1);
		expect(authUsers[0].email).toBe("admin@acme.com");
		expect(authUsers[0].scope).toBe("global-admin,tenant-admin,user-admin");

		interface ProfileRecord {
			privateProfile: { givenName: string; familyName: string; email: string };
		}
		const identityProfiles = await readStoreRecords<ProfileRecord>(dbDir, "identity-profile");
		expect(identityProfiles).toHaveLength(1);
		expect(identityProfiles[0].privateProfile.givenName).toBe("Tenant");
		expect(identityProfiles[0].privateProfile.email).toBe("admin@acme.com");

		const tenantsAfterFirst = await readStoreRecords(dbDir, "tenant");
		const identityDocs = await readStoreRecords(dbDir, "identity-document");

		const stateAfterSecond = await executeBootstrap(["bootstrap-dev"], stateAfterFirst, {
			TWIN_FEATURES: "wallet,admin-user",
			TWIN_STORAGE_FILE_ROOT: dbDir,
			TWIN_ADMIN_USER_NAME: "admin@acme.com"
		});
		expect(stateAfterSecond.nodeId).toEqual(stateAfterFirst.nodeId);
		expect(await readStoreRecords(dbDir, "tenant")).toEqual(tenantsAfterFirst);
		expect(await readStoreRecords(dbDir, "authentication-user")).toEqual(authUsers);
		expect(await readStoreRecords(dbDir, "identity-document")).toEqual(identityDocs);
		expect(await readStoreRecords(dbDir, "identity-profile")).toEqual(identityProfiles);
	});

	test("bootstrap-dev single-tenant: explicit admin user mnemonic is accepted and retained on re-run without mnemonic", async () => {
		const bootstrapDir = `${BOOTSTRAP_DIR}bootstrap-admin-mnemonic-single/`;
		const dbDir = `${bootstrapDir}db`;
		await rm(bootstrapDir, { recursive: true, force: true });

		// Run 1: specify admin mnemonic explicitly
		const stateAfterFirst = await executeBootstrap(
			["bootstrap-dev"],
			{},
			{
				TWIN_TENANT_ENABLED: "false",
				TWIN_FEATURES: "wallet,admin-user",
				TWIN_STORAGE_FILE_ROOT: dbDir,
				TWIN_ADMIN_USER_MNEMONIC: TEST_ADMIN_MNEMONIC
			}
		);
		expect(stateAfterFirst.nodeId).toBeDefined();
		expect(stateAfterFirst.nodeOrganizationId).toBeDefined();

		interface AuthUserRecord {
			email: string;
			identity: string;
		}
		const authUsers = await readStoreRecords<AuthUserRecord>(dbDir, "authentication-user");
		expect(authUsers).toHaveLength(1);

		// Snapshot DB state after run 1
		const identityDocs = await readStoreRecords(dbDir, "identity-document");
		const identityProfiles = await readStoreRecords(dbDir, "identity-profile");

		// Run 2: no mnemonic - admin user found by email, identity creation skipped
		const stateAfterSecond = await executeBootstrap(["bootstrap-dev"], stateAfterFirst, {
			TWIN_TENANT_ENABLED: "false",
			TWIN_FEATURES: "wallet,admin-user",
			TWIN_STORAGE_FILE_ROOT: dbDir
		});
		expect(stateAfterSecond.nodeId).toEqual(stateAfterFirst.nodeId);
		expect(stateAfterSecond.nodeOrganizationId).toEqual(stateAfterFirst.nodeOrganizationId);
		expect(await readStoreRecords(dbDir, "authentication-user")).toEqual(authUsers);
		expect(await readStoreRecords(dbDir, "identity-document")).toEqual(identityDocs);
		expect(await readStoreRecords(dbDir, "identity-profile")).toEqual(identityProfiles);
	});

	test("bootstrap-dev multi-tenant: explicit admin user mnemonic is accepted and retained on re-run without mnemonic", async () => {
		const bootstrapDir = `${BOOTSTRAP_DIR}bootstrap-admin-mnemonic-multi/`;
		const dbDir = `${bootstrapDir}db`;
		await rm(bootstrapDir, { recursive: true, force: true });

		// Run 1: specify admin mnemonic explicitly
		const stateAfterFirst = await executeBootstrap(
			["bootstrap-dev"],
			{},
			{
				TWIN_FEATURES: "wallet,admin-user",
				TWIN_STORAGE_FILE_ROOT: dbDir,
				TWIN_ADMIN_USER_MNEMONIC: TEST_ADMIN_MNEMONIC
			}
		);
		expect(stateAfterFirst.nodeId).toBeDefined();
		expect(stateAfterFirst.nodeOrganizationId).toBeUndefined();

		interface AuthUserRecord {
			email: string;
			identity: string;
		}
		const authUsers = await readStoreRecords<AuthUserRecord>(dbDir, "authentication-user");
		expect(authUsers).toHaveLength(1);

		// Snapshot DB state after run 1
		const tenants = await readStoreRecords(dbDir, "tenant");
		const identityDocs = await readStoreRecords(dbDir, "identity-document");
		const identityProfiles = await readStoreRecords(dbDir, "identity-profile");

		// Run 2: no mnemonic - admin user found by email, identity creation skipped
		const stateAfterSecond = await executeBootstrap(["bootstrap-dev"], stateAfterFirst, {
			TWIN_FEATURES: "wallet,admin-user",
			TWIN_STORAGE_FILE_ROOT: dbDir
		});
		expect(stateAfterSecond.nodeId).toEqual(stateAfterFirst.nodeId);
		expect(await readStoreRecords(dbDir, "tenant")).toEqual(tenants);
		expect(await readStoreRecords(dbDir, "authentication-user")).toEqual(authUsers);
		expect(await readStoreRecords(dbDir, "identity-document")).toEqual(identityDocs);
		expect(await readStoreRecords(dbDir, "identity-profile")).toEqual(identityProfiles);
	});
});
