// Copyright 2025 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFile, rm, writeFile } from "node:fs/promises";
import { CLIUtils } from "@twin.org/cli-core";
import { Converter, Factory } from "@twin.org/core";
import { MemoryStateStorage } from "@twin.org/engine-core";
import { AuthenticationAdminComponentType } from "@twin.org/engine-server-types";
import {
	EntityStorageConnectorType,
	FaucetConnectorType,
	IdentityConnectorType,
	IdentityProfileConnectorType,
	IdentityResolverConnectorType,
	VaultConnectorType,
	WalletConnectorType
} from "@twin.org/engine-types";
import type { INodeEngineState } from "../src/models/INodeEngineState.js";
import { run } from "../src/node.js";

const basePort = Math.floor(Math.random() * 1000);
let port = 3000 + basePort;
const OUTPUT_TMP_DIR = "./tests/.tmp/";

/**
 * Get the value from an env line.
 * @param line The env line.
 * @returns The value.
 */
function valueFromEnv(line?: string): string | undefined {
	return line?.split("=").slice(1).join("=").replace(/"/g, "");
}

async function readStoreRecords<T = unknown>(dbDir: string, entityType: string): Promise<T[]> {
	try {
		const content = await readFile(`${dbDir}/${entityType}/store.json`, "utf8");
		return JSON.parse(content) as T[];
	} catch {
		return [];
	}
}

/**
 * Execute a CLI command.
 * @param args The CLI args.
 * @param state The initial state.
 * @param additionalEnvVars Additional environment variables to set.
 * @param runOptions Additional options for the run function.
 * @param runOptions.disableProcessExitOnFailure Disable process exit on failure and throw instead.
 * @returns The state storage.
 */
async function executeCliCommand(
	args: string[],
	state: INodeEngineState,
	additionalEnvVars?: { [key: string]: string },
	runOptions?: { disableProcessExitOnFailure?: boolean }
): Promise<INodeEngineState> {
	const stateStorage = new MemoryStateStorage(false, state);
	await run(
		{
			localesDirectory: "./dist/locales/",
			stateStorage,
			disableProcessExitOnFailure: runOptions?.disableProcessExitOnFailure,
			envVars: {
				TWIN_DEBUG: "true",
				TWIN_SILENT: "true",
				TWIN_TENANT_ENABLED: "true",
				TWIN_PORT: port.toString(),
				TWIN_STORAGE_FILE_ROOT: `${OUTPUT_TMP_DIR}db`,
				TWIN_ENTITY_STORAGE_CONNECTOR_TYPE: EntityStorageConnectorType.File,
				TWIN_VAULT_CONNECTOR: VaultConnectorType.EntityStorage,
				TWIN_IDENTITY_CONNECTOR: IdentityConnectorType.EntityStorage,
				TWIN_IDENTITY_RESOLVER_CONNECTOR: IdentityResolverConnectorType.EntityStorage,
				TWIN_IDENTITY_PROFILE_CONNECTOR: IdentityProfileConnectorType.EntityStorage,
				TWIN_FAUCET_CONNECTOR: FaucetConnectorType.EntityStorage,
				TWIN_WALLET_CONNECTOR: WalletConnectorType.EntityStorage,
				TWIN_AUTH_ADMIN_PROCESSOR_TYPE: AuthenticationAdminComponentType.EntityStorage,
				...additionalEnvVars
			}
		},
		["node", "index.js", ...args]
	);
	return state;
}

let nodeIdentityJson: { mnemonic: string; did: string; walletAddress: string };
let organizationIdentityJson: { mnemonic: string; did: string; walletAddress: string };
let userIdentityJson: { mnemonic: string; did: string; walletAddress: string };
let nodeTenantJson: {
	apiKey: string;
	tenantId: string;
	organizationId?: string;
	label: string;
	publicOrigin: string;
};

// Canonical BIP39 24-word test vectors — deterministic key derivation
const TEST_NODE_MNEMONIC =
	"abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art";
const TEST_ORG_MNEMONIC =
	"legal winner thank year wave sausage worth useful legal winner thank year wave sausage worth useful legal winner thank year wave sausage worth title";
const TEST_ADMIN_MNEMONIC =
	"letter advice cage absurd amount doctor acoustic avoid letter advice cage absurd amount doctor acoustic avoid letter advice cage absurd amount doctor acoustic bless";

describe("node-core", () => {
	beforeAll(async () => {
		await rm(OUTPUT_TMP_DIR, { recursive: true, force: true });
	});

	beforeEach(() => {
		port++;

		Factory.clearFactories();
	});

	test("Can show the root help", async () => {
		await executeCliCommand(["--help"], {});
	});

	test("Can show the help for a command", async () => {
		await executeCliCommand(["bootstrap-legacy", "--help"], {});
	});

	test("Can bootstrap in legacy mode", async () => {
		await executeCliCommand(
			["bootstrap-legacy"],
			{},
			{
				TWIN_FEATURES: "wallet,admin-user"
			}
		);
	});

	test("bootstrap-legacy is idempotent with multi-tenancy when TENANT_ID is not set", async () => {
		const bootstrapDir = `${OUTPUT_TMP_DIR}bootstrap-idempotent/`;
		const dbDir = `${bootstrapDir}db`;
		await rm(bootstrapDir, { recursive: true, force: true });

		const runBootstrap = async (state: INodeEngineState): Promise<INodeEngineState> =>
			executeCliCommand(["bootstrap-legacy"], state, {
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

	test("bootstrap-legacy is idempotent in single-tenant mode with wallet and admin-user features", async () => {
		const bootstrapDir = `${OUTPUT_TMP_DIR}bootstrap-idempotent-single/`;
		const dbDir = `${bootstrapDir}db`;
		await rm(bootstrapDir, { recursive: true, force: true });

		const runBootstrap = async (state: INodeEngineState): Promise<INodeEngineState> =>
			executeCliCommand(["bootstrap-legacy"], state, {
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

	test("bootstrap-legacy is idempotent in single-tenant mode with wallet feature only", async () => {
		const bootstrapDir = `${OUTPUT_TMP_DIR}bootstrap-idempotent-single-wallet/`;
		const dbDir = `${bootstrapDir}db`;
		await rm(bootstrapDir, { recursive: true, force: true });

		const runBootstrap = async (state: INodeEngineState): Promise<INodeEngineState> =>
			executeCliCommand(["bootstrap-legacy"], state, {
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

	test("bootstrap-legacy multi-tenant: explicit tenant config propagates to DB and is retained on re-run without env vars", async () => {
		const bootstrapDir = `${OUTPUT_TMP_DIR}bootstrap-propagate-multi/`;
		const dbDir = `${bootstrapDir}db`;
		await rm(bootstrapDir, { recursive: true, force: true });

		// First run: configure with explicit tenant ID and API key
		const stateAfterFirst = await executeCliCommand(
			["bootstrap-legacy"],
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
		expect(authUsers[0].scope).toBe("tenant-admin,user-admin");

		// Verify identity documents include the node DID
		interface IdentityDocRecord {
			id: string;
		}
		const identityDocs = await readStoreRecords<IdentityDocRecord>(dbDir, "identity-document");
		expect(identityDocs.some(doc => doc.id === stateAfterFirst.nodeId)).toBe(true);
		const identityProfiles = await readStoreRecords(dbDir, "identity-profile");

		// Second run: no explicit tenant env vars — lookup by label must find the existing tenant
		const stateAfterSecond = await executeCliCommand(["bootstrap-legacy"], stateAfterFirst, {
			TWIN_FEATURES: "wallet,admin-user",
			TWIN_STORAGE_FILE_ROOT: dbDir
		});
		expect(stateAfterSecond.nodeId).toEqual(stateAfterFirst.nodeId);

		// All DB records must be byte-for-byte identical — nothing recreated or mutated
		expect(await readStoreRecords(dbDir, "tenant")).toEqual(tenants);
		expect(await readStoreRecords(dbDir, "authentication-user")).toEqual(authUsers);
		expect(await readStoreRecords(dbDir, "identity-document")).toEqual(identityDocs);
		expect(await readStoreRecords(dbDir, "identity-profile")).toEqual(identityProfiles);
	});

	test("bootstrap-legacy single-tenant: admin user config propagates to DB and is retained on re-run without env vars", async () => {
		const bootstrapDir = `${OUTPUT_TMP_DIR}bootstrap-propagate-single/`;
		const dbDir = `${bootstrapDir}db`;
		await rm(bootstrapDir, { recursive: true, force: true });

		// First run: no explicit admin user env vars — defaults apply
		const stateAfterFirst = await executeCliCommand(
			["bootstrap-legacy"],
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
		expect(authUsers[0].scope).toBe("user-admin");

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
		const stateAfterSecond = await executeCliCommand(["bootstrap-legacy"], stateAfterFirst, {
			TWIN_TENANT_ENABLED: "false",
			TWIN_FEATURES: "wallet,admin-user",
			TWIN_STORAGE_FILE_ROOT: dbDir
		});
		expect(stateAfterSecond.nodeId).toEqual(stateAfterFirst.nodeId);
		expect(stateAfterSecond.nodeOrganizationId).toEqual(stateAfterFirst.nodeOrganizationId);

		// All DB records must be byte-for-byte identical — nothing recreated or mutated
		expect(await readStoreRecords(dbDir, "authentication-user")).toEqual(authUsers);
		expect(await readStoreRecords(dbDir, "identity-document")).toEqual(identityDocs);
		expect(await readStoreRecords(dbDir, "identity-profile")).toEqual(identityProfiles);
	});

	test("bootstrap-legacy single-tenant: explicit node and org mnemonics are accepted and retained on re-run without mnemonics", async () => {
		const bootstrapDir = `${OUTPUT_TMP_DIR}bootstrap-mnemonic-single/`;
		const dbDir = `${bootstrapDir}db`;
		await rm(bootstrapDir, { recursive: true, force: true });

		// Run 1: specify mnemonics explicitly
		const stateAfterFirst = await executeCliCommand(
			["bootstrap-legacy"],
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

		// Run 2: no mnemonics — vault already holds them, identities already exist
		const stateAfterSecond = await executeCliCommand(["bootstrap-legacy"], stateAfterFirst, {
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

	test("bootstrap-legacy multi-tenant: explicit node and org mnemonics are accepted and retained on re-run without mnemonics", async () => {
		const bootstrapDir = `${OUTPUT_TMP_DIR}bootstrap-mnemonic-multi/`;
		const dbDir = `${bootstrapDir}db`;
		await rm(bootstrapDir, { recursive: true, force: true });

		// Run 1: specify mnemonics explicitly
		const stateAfterFirst = await executeCliCommand(
			["bootstrap-legacy"],
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

		// Run 2: no mnemonics — vault already holds them, tenant and identities already exist
		const stateAfterSecond = await executeCliCommand(["bootstrap-legacy"], stateAfterFirst, {
			TWIN_FEATURES: "wallet,admin-user",
			TWIN_STORAGE_FILE_ROOT: dbDir
		});
		expect(stateAfterSecond.nodeId).toEqual(stateAfterFirst.nodeId);
		expect(await readStoreRecords(dbDir, "tenant")).toEqual(tenants);
		expect(await readStoreRecords(dbDir, "identity-document")).toEqual(identityDocs);
		expect(await readStoreRecords(dbDir, "authentication-user")).toEqual(authUsers);
		expect(await readStoreRecords(dbDir, "identity-profile")).toEqual(identityProfiles);
	});

	test("bootstrap-legacy single-tenant: custom admin user name and password propagate to DB and are retained on re-run without password", async () => {
		const bootstrapDir = `${OUTPUT_TMP_DIR}bootstrap-admin-single/`;
		const dbDir = `${bootstrapDir}db`;
		await rm(bootstrapDir, { recursive: true, force: true });

		// Run 1: explicit admin name and password
		const stateAfterFirst = await executeCliCommand(
			["bootstrap-legacy"],
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
		expect(authUsers[0].scope).toBe("user-admin");

		interface ProfileRecord {
			privateProfile: { givenName: string; familyName: string; email: string };
		}
		const identityProfiles = await readStoreRecords<ProfileRecord>(dbDir, "identity-profile");
		expect(identityProfiles).toHaveLength(1);
		expect(identityProfiles[0].privateProfile.givenName).toBe("Node");
		expect(identityProfiles[0].privateProfile.email).toBe("admin@acme.com");

		const identityDocs = await readStoreRecords(dbDir, "identity-document");

		// Run 2: same name, no password — overwriteMode:skip must leave the record untouched
		const stateAfterSecond = await executeCliCommand(["bootstrap-legacy"], stateAfterFirst, {
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

	test("bootstrap-legacy multi-tenant: custom admin user name and password propagate to DB and are retained on re-run without password", async () => {
		const bootstrapDir = `${OUTPUT_TMP_DIR}bootstrap-admin-multi/`;
		const dbDir = `${bootstrapDir}db`;
		await rm(bootstrapDir, { recursive: true, force: true });

		const stateAfterFirst = await executeCliCommand(
			["bootstrap-legacy"],
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
		expect(authUsers[0].scope).toBe("tenant-admin,user-admin");

		interface ProfileRecord {
			privateProfile: { givenName: string; familyName: string; email: string };
		}
		const identityProfiles = await readStoreRecords<ProfileRecord>(dbDir, "identity-profile");
		expect(identityProfiles).toHaveLength(1);
		expect(identityProfiles[0].privateProfile.givenName).toBe("Tenant");
		expect(identityProfiles[0].privateProfile.email).toBe("admin@acme.com");

		const tenantsAfterFirst = await readStoreRecords(dbDir, "tenant");
		const identityDocs = await readStoreRecords(dbDir, "identity-document");

		const stateAfterSecond = await executeCliCommand(["bootstrap-legacy"], stateAfterFirst, {
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

	test("bootstrap-legacy single-tenant: explicit admin user mnemonic is accepted and retained on re-run without mnemonic", async () => {
		const bootstrapDir = `${OUTPUT_TMP_DIR}bootstrap-admin-mnemonic-single/`;
		const dbDir = `${bootstrapDir}db`;
		await rm(bootstrapDir, { recursive: true, force: true });

		// Run 1: specify admin mnemonic explicitly
		const stateAfterFirst = await executeCliCommand(
			["bootstrap-legacy"],
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

		// Run 2: no mnemonic — admin user found by email, identity creation skipped
		const stateAfterSecond = await executeCliCommand(["bootstrap-legacy"], stateAfterFirst, {
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

	test("bootstrap-legacy multi-tenant: explicit admin user mnemonic is accepted and retained on re-run without mnemonic", async () => {
		const bootstrapDir = `${OUTPUT_TMP_DIR}bootstrap-admin-mnemonic-multi/`;
		const dbDir = `${bootstrapDir}db`;
		await rm(bootstrapDir, { recursive: true, force: true });

		// Run 1: specify admin mnemonic explicitly
		const stateAfterFirst = await executeCliCommand(
			["bootstrap-legacy"],
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

		// Run 2: no mnemonic — admin user found by email, identity creation skipped
		const stateAfterSecond = await executeCliCommand(["bootstrap-legacy"], stateAfterFirst, {
			TWIN_FEATURES: "wallet,admin-user",
			TWIN_STORAGE_FILE_ROOT: dbDir
		});
		expect(stateAfterSecond.nodeId).toEqual(stateAfterFirst.nodeId);
		expect(await readStoreRecords(dbDir, "tenant")).toEqual(tenants);
		expect(await readStoreRecords(dbDir, "authentication-user")).toEqual(authUsers);
		expect(await readStoreRecords(dbDir, "identity-document")).toEqual(identityDocs);
		expect(await readStoreRecords(dbDir, "identity-profile")).toEqual(identityProfiles);
	});

	test("Can create the node identity", async () => {
		await executeCliCommand(
			[
				"identity-create",
				"--fund-wallet=true",
				`--output-json=${OUTPUT_TMP_DIR}node-identity.json`,
				`--output-env=${OUTPUT_TMP_DIR}node-identity.env`,
				"--output-env-prefix=node"
			],
			{}
		);

		nodeIdentityJson = await CLIUtils.readJsonFile<any>(`${OUTPUT_TMP_DIR}node-identity.json`);
		const nodeIdentityEnv = await CLIUtils.readLinesFile(`${OUTPUT_TMP_DIR}node-identity.env`);
		expect(nodeIdentityJson?.mnemonic).toEqual(valueFromEnv(nodeIdentityEnv?.[0]));
		expect(nodeIdentityJson?.did).toEqual(valueFromEnv(nodeIdentityEnv?.[1]));
		expect(nodeIdentityJson?.walletAddress).toEqual(valueFromEnv(nodeIdentityEnv?.[2]));
	});

	test("Can import an identity", async () => {
		await executeCliCommand(
			[
				"identity-import",
				`--identity=${nodeIdentityJson?.did}`,
				`--mnemonic=${nodeIdentityJson?.mnemonic}`
			],
			{}
		);
	});

	test("Can set the node identity", async () => {
		const nodeState = await executeCliCommand(
			[
				"node-set-identity",
				`--load-env=${OUTPUT_TMP_DIR}node-identity.env`,
				"--identity=!NODE_DID"
			],
			{}
		);
		expect(nodeState).toEqual({ nodeId: nodeIdentityJson?.did });
	});

	test("Can create the node auth key", async () => {
		await executeCliCommand(
			[
				"vault-key-create",
				`--load-env=${OUTPUT_TMP_DIR}node-identity.env`,
				"--identity=!NODE_DID",
				"--key-id=!TWIN_AUTH_SIGNING_KEY_ID",
				`--output-json=${OUTPUT_TMP_DIR}node-auth-key.json`,
				`--output-env=${OUTPUT_TMP_DIR}node-auth-key.env`
			],
			{ nodeId: nodeIdentityJson?.did }
		);

		const nodeAuthKeyJson = await CLIUtils.readJsonFile<any>(`${OUTPUT_TMP_DIR}node-auth-key.json`);
		const nodeAuthKeyEnv = await CLIUtils.readLinesFile(`${OUTPUT_TMP_DIR}node-auth-key.env`);
		expect(nodeAuthKeyJson?.identity).toEqual(nodeIdentityJson?.did);
		expect(nodeAuthKeyJson?.identity).toEqual(valueFromEnv(nodeAuthKeyEnv?.[0]));
		expect(nodeAuthKeyJson?.keyId).toEqual(valueFromEnv(nodeAuthKeyEnv?.[1]));
		expect(nodeAuthKeyJson?.keyType).toEqual(valueFromEnv(nodeAuthKeyEnv?.[2]));
		expect(nodeAuthKeyJson?.privateKeyBase64).toEqual(valueFromEnv(nodeAuthKeyEnv?.[3]));
		expect(nodeAuthKeyJson?.publicKeyBase64).toEqual(valueFromEnv(nodeAuthKeyEnv?.[4]));
		expect(nodeAuthKeyJson?.privateKeyHex).toEqual(valueFromEnv(nodeAuthKeyEnv?.[5]));
		expect(nodeAuthKeyJson?.publicKeyHex).toEqual(valueFromEnv(nodeAuthKeyEnv?.[6]));
	});

	test("Can import the node auth key", async () => {
		const nodeAuthKeyJson = await CLIUtils.readJsonFile<any>(`${OUTPUT_TMP_DIR}node-auth-key.json`);

		await executeCliCommand(
			[
				"vault-key-import",
				`--identity=${nodeIdentityJson.did}`,
				"--key-id=!TWIN_AUTH_SIGNING_KEY_ID",
				`--key-type=${nodeAuthKeyJson?.keyType}`,
				`--private-key-hex=${nodeAuthKeyJson?.privateKeyHex}`
			],
			{ nodeId: nodeIdentityJson?.did }
		);
	});

	test("Can create the organization identity", async () => {
		await executeCliCommand(
			[
				"identity-create",
				`--load-env=${OUTPUT_TMP_DIR}node-identity.env`,
				"--fund-wallet=true",
				"--controller=!NODE_DID",
				`--output-json=${OUTPUT_TMP_DIR}organization-identity.json`,
				`--output-env=${OUTPUT_TMP_DIR}organization-identity.env`,
				"--output-env-prefix=organization"
			],
			{}
		);

		organizationIdentityJson = await CLIUtils.readJsonFile<any>(
			`${OUTPUT_TMP_DIR}organization-identity.json`
		);
		const organizationIdentityEnv = await CLIUtils.readLinesFile(
			`${OUTPUT_TMP_DIR}organization-identity.env`
		);
		expect(organizationIdentityJson?.mnemonic).toEqual(valueFromEnv(organizationIdentityEnv?.[0]));
		expect(organizationIdentityJson?.did).toEqual(valueFromEnv(organizationIdentityEnv?.[1]));
		expect(organizationIdentityJson?.walletAddress).toEqual(
			valueFromEnv(organizationIdentityEnv?.[2])
		);
	});

	test("Can create the tenant for the node", async () => {
		await executeCliCommand(
			[
				"tenant-create",
				`--load-env=${OUTPUT_TMP_DIR}organization-identity.env`,
				"--organization-id=!ORGANIZATION_DID",
				`--output-json=${OUTPUT_TMP_DIR}node-tenant.json`,
				`--output-env=${OUTPUT_TMP_DIR}node-tenant.env`,
				"--label=node",
				"--public-origin=https://api.example.com:1234",
				"--output-env-prefix=node"
			],
			{ nodeId: nodeIdentityJson?.did }
		);

		nodeTenantJson = await CLIUtils.readJsonFile<any>(`${OUTPUT_TMP_DIR}node-tenant.json`);
		const nodeTenantEnv = await CLIUtils.readLinesFile(`${OUTPUT_TMP_DIR}node-tenant.env`);
		expect(nodeTenantJson?.apiKey).toEqual(valueFromEnv(nodeTenantEnv?.[0]));
		expect(nodeTenantJson?.tenantId).toEqual(valueFromEnv(nodeTenantEnv?.[1]));
		expect(nodeTenantJson?.organizationId).toEqual(valueFromEnv(nodeTenantEnv?.[2]));
		expect(nodeTenantJson?.label).toEqual(valueFromEnv(nodeTenantEnv?.[3]));
		expect(nodeTenantJson?.publicOrigin).toEqual(valueFromEnv(nodeTenantEnv?.[4]));

		const dbTable = await CLIUtils.readJsonFile<any>(`${OUTPUT_TMP_DIR}db/tenant/store.json`);
		expect(dbTable?.[1]?.label).toEqual("node");
		expect(dbTable?.[1]?.publicOrigin).toEqual("https://api.example.com:1234");

		const nodeIdParts = nodeIdentityJson?.did.split(":");
		const partitionId = Converter.bytesToBase64Url(Converter.hexToBytes(nodeIdParts[2]));
		expect(dbTable?.[1]?.partitionId).toEqual(partitionId);
	});

	test("Can import the tenant for the node", async () => {
		await executeCliCommand(
			[
				"tenant-import",
				`--tenant-id=${nodeTenantJson?.tenantId}`,
				`--api-key=${nodeTenantJson?.apiKey}`,
				`--label=${nodeTenantJson?.label}`,
				`--public-origin=${nodeTenantJson?.publicOrigin}`
			],
			{ nodeId: nodeIdentityJson?.did }
		);
	});

	test("Can update the node tenant", async () => {
		await executeCliCommand(
			[
				"tenant-update",
				`--load-env=${OUTPUT_TMP_DIR}node-tenant.env`,
				"--tenant-id=!NODE_TENANT_ID",
				"--label=updated-node",
				"--public-origin=https://api.updated.com:5678"
			],
			{ nodeId: nodeIdentityJson?.did }
		);

		const dbTable = await CLIUtils.readJsonFile<any>(`${OUTPUT_TMP_DIR}db/tenant/store.json`);
		expect(dbTable?.[1]?.label).toEqual("updated-node");
		expect(dbTable?.[1]?.publicOrigin).toEqual("https://api.updated.com:5678");
	});

	test("Can create the organization attestation verification method", async () => {
		await executeCliCommand(
			[
				"identity-verification-method-create",
				`--load-env=${OUTPUT_TMP_DIR}node-identity.env,${OUTPUT_TMP_DIR}organization-identity.env`,
				"--identity=!ORGANIZATION_DID",
				"--controller=!NODE_DID",
				"--verification-method-id=!TWIN_ATTESTATION_VERIFICATION_METHOD_ID",
				`--output-json=${OUTPUT_TMP_DIR}organization-attestation.json`,
				`--output-env=${OUTPUT_TMP_DIR}organization-attestation.env`
			],
			{}
		);

		const organizationAttestationJson = await CLIUtils.readJsonFile<any>(
			`${OUTPUT_TMP_DIR}organization-attestation.json`
		);
		const organizationAttestationEnv = await CLIUtils.readLinesFile(
			`${OUTPUT_TMP_DIR}organization-attestation.env`
		);
		expect(organizationAttestationJson?.verificationMethodId).toEqual(
			`${organizationIdentityJson.did}#attestation-assertion`
		);
		expect(organizationAttestationJson?.verificationMethodId).toEqual(
			valueFromEnv(organizationAttestationEnv?.[0])
		);
		expect(organizationAttestationJson?.verificationMethodType).toEqual(
			valueFromEnv(organizationAttestationEnv?.[1])
		);
		expect(organizationAttestationJson?.privateKeyJwk?.kid).toEqual(
			valueFromEnv(organizationAttestationEnv?.[2])
		);
		expect(organizationAttestationJson?.privateKeyJwk?.kty).toEqual(
			valueFromEnv(organizationAttestationEnv?.[3])
		);
		expect(organizationAttestationJson?.privateKeyJwk?.use).toEqual(
			valueFromEnv(organizationAttestationEnv?.[4])
		);
		expect(organizationAttestationJson?.privateKeyJwk?.alg).toEqual(
			valueFromEnv(organizationAttestationEnv?.[5])
		);
		expect(organizationAttestationJson?.privateKeyJwk?.crv).toEqual(
			valueFromEnv(organizationAttestationEnv?.[6])
		);
		expect(organizationAttestationJson?.privateKeyJwk?.x).toEqual(
			valueFromEnv(organizationAttestationEnv?.[7])
		);
		expect(organizationAttestationJson?.privateKeyJwk?.d).toEqual(
			valueFromEnv(organizationAttestationEnv?.[8])
		);
		expect(organizationAttestationJson?.privateKeyHex).toEqual(
			valueFromEnv(organizationAttestationEnv?.[9])
		);
		expect(organizationAttestationJson?.publicKeyHex).toEqual(
			valueFromEnv(organizationAttestationEnv?.[10])
		);
		expect(organizationAttestationJson?.privateKeyBase64).toEqual(
			valueFromEnv(organizationAttestationEnv?.[11])
		);
		expect(organizationAttestationJson?.publicKeyBase64).toEqual(
			valueFromEnv(organizationAttestationEnv?.[12])
		);
	});

	test("Can create the organization immutable proof verification method", async () => {
		await executeCliCommand(
			[
				"identity-verification-method-create",
				`--load-env=${OUTPUT_TMP_DIR}node-identity.env,${OUTPUT_TMP_DIR}organization-identity.env`,
				"--identity=!ORGANIZATION_DID",
				"--controller=!NODE_DID",
				"--verification-method-id=!TWIN_IMMUTABLE_PROOF_VERIFICATION_METHOD_ID",
				`--output-json=${OUTPUT_TMP_DIR}organization-immutable-proof.json`,
				`--output-env=${OUTPUT_TMP_DIR}organization-immutable-proof.env`
			],
			{}
		);

		const organizationImmutableProofJson = await CLIUtils.readJsonFile<any>(
			`${OUTPUT_TMP_DIR}organization-immutable-proof.json`
		);
		const organizationImmutableProofEnv = await CLIUtils.readLinesFile(
			`${OUTPUT_TMP_DIR}organization-immutable-proof.env`
		);
		expect(organizationImmutableProofJson?.verificationMethodId).toEqual(
			`${organizationIdentityJson.did}#immutable-proof-assertion`
		);
		expect(organizationImmutableProofJson?.verificationMethodId).toEqual(
			valueFromEnv(organizationImmutableProofEnv?.[0])
		);
		expect(organizationImmutableProofJson?.verificationMethodType).toEqual(
			valueFromEnv(organizationImmutableProofEnv?.[1])
		);
		expect(organizationImmutableProofJson?.privateKeyJwk?.kid).toEqual(
			valueFromEnv(organizationImmutableProofEnv?.[2])
		);
		expect(organizationImmutableProofJson?.privateKeyJwk?.kty).toEqual(
			valueFromEnv(organizationImmutableProofEnv?.[3])
		);
		expect(organizationImmutableProofJson?.privateKeyJwk?.use).toEqual(
			valueFromEnv(organizationImmutableProofEnv?.[4])
		);
		expect(organizationImmutableProofJson?.privateKeyJwk?.alg).toEqual(
			valueFromEnv(organizationImmutableProofEnv?.[5])
		);
		expect(organizationImmutableProofJson?.privateKeyJwk?.crv).toEqual(
			valueFromEnv(organizationImmutableProofEnv?.[6])
		);
		expect(organizationImmutableProofJson?.privateKeyJwk?.x).toEqual(
			valueFromEnv(organizationImmutableProofEnv?.[7])
		);
		expect(organizationImmutableProofJson?.privateKeyJwk?.d).toEqual(
			valueFromEnv(organizationImmutableProofEnv?.[8])
		);
		expect(organizationImmutableProofJson?.privateKeyHex).toEqual(
			valueFromEnv(organizationImmutableProofEnv?.[9])
		);
		expect(organizationImmutableProofJson?.publicKeyHex).toEqual(
			valueFromEnv(organizationImmutableProofEnv?.[10])
		);
		expect(organizationImmutableProofJson?.privateKeyBase64).toEqual(
			valueFromEnv(organizationImmutableProofEnv?.[11])
		);
		expect(organizationImmutableProofJson?.publicKeyBase64).toEqual(
			valueFromEnv(organizationImmutableProofEnv?.[12])
		);
	});

	test("Can create the organization vc authentication verification method", async () => {
		await executeCliCommand(
			[
				"identity-verification-method-create",
				`--load-env=${OUTPUT_TMP_DIR}node-identity.env,${OUTPUT_TMP_DIR}organization-identity.env`,
				"--identity=!ORGANIZATION_DID",
				"--controller=!NODE_DID",
				"--verification-method-id=!TWIN_TRUST_VERIFICATION_METHOD_ID",
				`--output-json=${OUTPUT_TMP_DIR}organization-trust.json`,
				`--output-env=${OUTPUT_TMP_DIR}organization-trust.env`
			],
			{}
		);

		const organizationVcAuthenticationJson = await CLIUtils.readJsonFile<any>(
			`${OUTPUT_TMP_DIR}organization-trust.json`
		);
		const organizationVcAuthenticationEnv = await CLIUtils.readLinesFile(
			`${OUTPUT_TMP_DIR}organization-trust.env`
		);
		expect(organizationVcAuthenticationJson?.verificationMethodId).toEqual(
			`${organizationIdentityJson.did}#trust-assertion`
		);
		expect(organizationVcAuthenticationJson?.verificationMethodId).toEqual(
			valueFromEnv(organizationVcAuthenticationEnv?.[0])
		);
		expect(organizationVcAuthenticationJson?.verificationMethodType).toEqual(
			valueFromEnv(organizationVcAuthenticationEnv?.[1])
		);
		expect(organizationVcAuthenticationJson?.privateKeyJwk?.kid).toEqual(
			valueFromEnv(organizationVcAuthenticationEnv?.[2])
		);
		expect(organizationVcAuthenticationJson?.privateKeyJwk?.kty).toEqual(
			valueFromEnv(organizationVcAuthenticationEnv?.[3])
		);
		expect(organizationVcAuthenticationJson?.privateKeyJwk?.use).toEqual(
			valueFromEnv(organizationVcAuthenticationEnv?.[4])
		);
		expect(organizationVcAuthenticationJson?.privateKeyJwk?.alg).toEqual(
			valueFromEnv(organizationVcAuthenticationEnv?.[5])
		);
		expect(organizationVcAuthenticationJson?.privateKeyJwk?.crv).toEqual(
			valueFromEnv(organizationVcAuthenticationEnv?.[6])
		);
		expect(organizationVcAuthenticationJson?.privateKeyJwk?.x).toEqual(
			valueFromEnv(organizationVcAuthenticationEnv?.[7])
		);
		expect(organizationVcAuthenticationJson?.privateKeyJwk?.d).toEqual(
			valueFromEnv(organizationVcAuthenticationEnv?.[8])
		);
		expect(organizationVcAuthenticationJson?.privateKeyHex).toEqual(
			valueFromEnv(organizationVcAuthenticationEnv?.[9])
		);
		expect(organizationVcAuthenticationJson?.publicKeyHex).toEqual(
			valueFromEnv(organizationVcAuthenticationEnv?.[10])
		);
		expect(organizationVcAuthenticationJson?.privateKeyBase64).toEqual(
			valueFromEnv(organizationVcAuthenticationEnv?.[11])
		);
		expect(organizationVcAuthenticationJson?.publicKeyBase64).toEqual(
			valueFromEnv(organizationVcAuthenticationEnv?.[12])
		);
	});

	test("Can create the organization blob storage encryption key", async () => {
		await executeCliCommand(
			[
				"vault-key-create",
				`--load-env=${OUTPUT_TMP_DIR}organization-identity.env`,
				"--identity=!ORGANIZATION_DID",
				"--key-id=!TWIN_BLOB_STORAGE_ENCRYPTION_KEY_ID",
				"--key-type=ChaCha20Poly1305",
				`--output-json=${OUTPUT_TMP_DIR}organization-blob-encryption.json`,
				`--output-env=${OUTPUT_TMP_DIR}organization-blob-encryption.env`
			],
			{ nodeId: nodeIdentityJson?.did }
		);

		const organizationBlobEncryptionJson = await CLIUtils.readJsonFile<any>(
			`${OUTPUT_TMP_DIR}organization-blob-encryption.json`
		);
		const organizationBlobEncryptionEnv = await CLIUtils.readLinesFile(
			`${OUTPUT_TMP_DIR}organization-blob-encryption.env`
		);
		expect(organizationBlobEncryptionJson?.identity).toEqual(organizationIdentityJson?.did);
		expect(organizationBlobEncryptionJson?.identity).toEqual(
			valueFromEnv(organizationBlobEncryptionEnv?.[0])
		);
		expect(organizationBlobEncryptionJson?.keyId).toEqual(
			valueFromEnv(organizationBlobEncryptionEnv?.[1])
		);
		expect(organizationBlobEncryptionJson?.keyType).toEqual(
			valueFromEnv(organizationBlobEncryptionEnv?.[2])
		);
		expect(organizationBlobEncryptionJson?.privateKeyBase64).toEqual(
			valueFromEnv(organizationBlobEncryptionEnv?.[3])
		);
		expect(organizationBlobEncryptionJson?.privateKeyHex).toEqual(
			valueFromEnv(organizationBlobEncryptionEnv?.[4])
		);
	});

	test("Can create the user identity", async () => {
		await executeCliCommand(
			[
				"identity-create",
				`--load-env=${OUTPUT_TMP_DIR}organization-identity.env`,
				"--controller=!ORGANIZATION_DID",
				`--output-json=${OUTPUT_TMP_DIR}user-identity.json`,
				`--output-env=${OUTPUT_TMP_DIR}user-identity.env`,
				"--output-env-prefix=user"
			],
			{}
		);

		userIdentityJson = await CLIUtils.readJsonFile<any>(`${OUTPUT_TMP_DIR}user-identity.json`);
		const userIdentityEnv = await CLIUtils.readLinesFile(`${OUTPUT_TMP_DIR}user-identity.env`);
		expect(userIdentityJson?.mnemonic).toEqual(valueFromEnv(userIdentityEnv?.[0]));
		expect(userIdentityJson?.did).toEqual(valueFromEnv(userIdentityEnv?.[1]));
		expect(userIdentityJson?.walletAddress).toBeUndefined();
	});

	test("Can create the user account", async () => {
		const envParts = [
			`${OUTPUT_TMP_DIR}organization-identity.env`,
			`${OUTPUT_TMP_DIR}user-identity.env`,
			`${OUTPUT_TMP_DIR}node-tenant.env`
		];
		await executeCliCommand(
			[
				"user-create",
				`--load-env=${envParts.join(",")}`,
				"--user-identity=!USER_DID",
				"--organization-identity=!ORGANIZATION_DID",
				"--tenant-id=!NODE_TENANT_ID",
				"--email=admin@node",
				"--scope=tenant-admin,doo",
				`--output-json=${OUTPUT_TMP_DIR}user-account-admin.json`,
				`--output-env=${OUTPUT_TMP_DIR}user-account-admin.env`,
				"--output-env-prefix=admin"
			],
			{ nodeId: nodeIdentityJson?.did }
		);

		const userAccountAdminJson = await CLIUtils.readJsonFile<any>(
			`${OUTPUT_TMP_DIR}user-account-admin.json`
		);
		const userAccountAdminEnv = await CLIUtils.readLinesFile(
			`${OUTPUT_TMP_DIR}user-account-admin.env`
		);
		expect(userAccountAdminJson?.did).toEqual(valueFromEnv(userAccountAdminEnv?.[0]));
		expect(userAccountAdminJson?.organizationDid).toEqual(valueFromEnv(userAccountAdminEnv?.[1]));
		expect(userAccountAdminJson?.email).toEqual(valueFromEnv(userAccountAdminEnv?.[2]));
		expect(userAccountAdminJson?.password).toEqual(valueFromEnv(userAccountAdminEnv?.[3]));
		expect(userAccountAdminJson?.scope.join(",")).toEqual(valueFromEnv(userAccountAdminEnv?.[4]));
		expect(userAccountAdminJson?.givenName).toEqual(valueFromEnv(userAccountAdminEnv?.[5]));
		expect(userAccountAdminJson?.familyName).toEqual(valueFromEnv(userAccountAdminEnv?.[6]));

		const dbTable = await CLIUtils.readJsonFile<any>(
			`${OUTPUT_TMP_DIR}db/authentication-user/store.json`
		);
		expect(dbTable?.[1]?.email).toEqual("admin@node");
		expect(dbTable?.[1]?.scope).toEqual("tenant-admin,doo");

		const nodeIdParts = nodeIdentityJson?.did.split(":");
		const nodePartitionId = Converter.bytesToBase64Url(Converter.hexToBytes(nodeIdParts[2]));

		const tenantPartitionId = Converter.bytesToBase64Url(
			Converter.hexToBytes(nodeTenantJson?.tenantId)
		);
		expect(dbTable?.[1]?.partitionId).toEqual(`${nodePartitionId}/${tenantPartitionId}`);
	});

	test("user-create throws when multi-tenancy is enabled and tenant-id is missing", async () => {
		const envParts = [
			`${OUTPUT_TMP_DIR}organization-identity.env`,
			`${OUTPUT_TMP_DIR}user-identity.env`
		];
		await expect(
			executeCliCommand(
				[
					"user-create",
					`--load-env=${envParts.join(",")}`,
					"--user-identity=!USER_DID",
					"--organization-identity=!ORGANIZATION_DID",
					"--email=admin-no-tenant@node"
				],
				{ nodeId: nodeIdentityJson?.did },
				undefined,
				{ disableProcessExitOnFailure: true }
			)
		).rejects.toThrow();
	});

	test("user-create works when multi-tenancy is enabled and tenant-id is provided", async () => {
		const envParts = [
			`${OUTPUT_TMP_DIR}organization-identity.env`,
			`${OUTPUT_TMP_DIR}user-identity.env`,
			`${OUTPUT_TMP_DIR}node-tenant.env`
		];
		// Use skip mode with the already-created email to confirm the tenantId check passes
		// and the command runs through to user lookup without throwing tenantIdRequired.
		await executeCliCommand(
			[
				"user-create",
				`--load-env=${envParts.join(",")}`,
				"--user-identity=!USER_DID",
				"--organization-identity=!ORGANIZATION_DID",
				"--tenant-id=!NODE_TENANT_ID",
				"--email=admin@node",
				"--overwrite-mode=skip"
			],
			{ nodeId: nodeIdentityJson?.did }
		);
	});

	test("user-update throws when multi-tenancy is enabled and tenant-id is missing", async () => {
		const envParts = [
			`${OUTPUT_TMP_DIR}organization-identity.env`,
			`${OUTPUT_TMP_DIR}user-identity.env`
		];
		await expect(
			executeCliCommand(
				["user-update", `--load-env=${envParts.join(",")}`, "--email=admin@node"],
				{ nodeId: nodeIdentityJson?.did },
				undefined,
				{ disableProcessExitOnFailure: true }
			)
		).rejects.toThrow();
	});

	test("user-update works when multi-tenancy is enabled and tenant-id is provided", async () => {
		const envParts = [
			`${OUTPUT_TMP_DIR}organization-identity.env`,
			`${OUTPUT_TMP_DIR}user-identity.env`,
			`${OUTPUT_TMP_DIR}node-tenant.env`
		];
		await executeCliCommand(
			[
				"user-update",
				`--load-env=${envParts.join(",")}`,
				"--tenant-id=!NODE_TENANT_ID",
				"--email=admin@node",
				"--scope=tenant-admin,doo",
				"--given-name=Admin",
				"--family-name=Node"
			],
			{ nodeId: nodeIdentityJson?.did }
		);
	});

	test("user-create throws with overwrite-mode error when user already exists", async () => {
		const envParts = [
			`${OUTPUT_TMP_DIR}organization-identity.env`,
			`${OUTPUT_TMP_DIR}user-identity.env`,
			`${OUTPUT_TMP_DIR}node-tenant.env`
		];
		await expect(
			executeCliCommand(
				[
					"user-create",
					`--load-env=${envParts.join(",")}`,
					"--user-identity=!USER_DID",
					"--organization-identity=!ORGANIZATION_DID",
					"--tenant-id=!NODE_TENANT_ID",
					"--email=admin@node",
					"--overwrite-mode=error"
				],
				{ nodeId: nodeIdentityJson?.did },
				undefined,
				{ disableProcessExitOnFailure: true }
			)
		).rejects.toThrow();
	});

	test("user-create replaces user with overwrite-mode overwrite", async () => {
		const envParts = [
			`${OUTPUT_TMP_DIR}organization-identity.env`,
			`${OUTPUT_TMP_DIR}user-identity.env`,
			`${OUTPUT_TMP_DIR}node-tenant.env`
		];
		await executeCliCommand(
			[
				"user-create",
				`--load-env=${envParts.join(",")}`,
				"--user-identity=!USER_DID",
				"--organization-identity=!ORGANIZATION_DID",
				"--tenant-id=!NODE_TENANT_ID",
				"--email=admin@node",
				"--scope=tenant-admin",
				"--overwrite-mode=overwrite",
				`--output-json=${OUTPUT_TMP_DIR}user-account-overwrite.json`
			],
			{ nodeId: nodeIdentityJson?.did }
		);

		const userJson = await CLIUtils.readJsonFile<any>(
			`${OUTPUT_TMP_DIR}user-account-overwrite.json`
		);
		expect(userJson?.email).toEqual("admin@node");
		expect(userJson?.scope).toEqual(["tenant-admin"]);
	});

	test("user-create throws when password is too short", async () => {
		const envParts = [
			`${OUTPUT_TMP_DIR}organization-identity.env`,
			`${OUTPUT_TMP_DIR}user-identity.env`,
			`${OUTPUT_TMP_DIR}node-tenant.env`
		];
		await expect(
			executeCliCommand(
				[
					"user-create",
					`--load-env=${envParts.join(",")}`,
					"--user-identity=!USER_DID",
					"--organization-identity=!ORGANIZATION_DID",
					"--tenant-id=!NODE_TENANT_ID",
					"--email=admin-short-pw@node",
					"--password=tooshort"
				],
				{ nodeId: nodeIdentityJson?.did },
				undefined,
				{ disableProcessExitOnFailure: true }
			)
		).rejects.toThrow();
	});

	test("user-update throws when user is not found", async () => {
		const envParts = [
			`${OUTPUT_TMP_DIR}organization-identity.env`,
			`${OUTPUT_TMP_DIR}user-identity.env`,
			`${OUTPUT_TMP_DIR}node-tenant.env`
		];
		await expect(
			executeCliCommand(
				[
					"user-update",
					`--load-env=${envParts.join(",")}`,
					"--tenant-id=!NODE_TENANT_ID",
					"--email=nonexistent@node"
				],
				{ nodeId: nodeIdentityJson?.did },
				undefined,
				{ disableProcessExitOnFailure: true }
			)
		).rejects.toThrow();
	});

	test("vault-key-create throws with overwrite-mode error when key already exists", async () => {
		await expect(
			executeCliCommand(
				[
					"vault-key-create",
					`--load-env=${OUTPUT_TMP_DIR}node-identity.env`,
					"--identity=!NODE_DID",
					"--key-id=!TWIN_AUTH_SIGNING_KEY_ID",
					"--overwrite-mode=error"
				],
				{ nodeId: nodeIdentityJson?.did },
				undefined,
				{ disableProcessExitOnFailure: true }
			)
		).rejects.toThrow();
	});

	test("vault-key-create recreates key with overwrite-mode overwrite", async () => {
		await executeCliCommand(
			[
				"vault-key-create",
				`--load-env=${OUTPUT_TMP_DIR}node-identity.env`,
				"--identity=!NODE_DID",
				"--key-id=test-overwrite-key",
				"--key-type=Ed25519",
				"--overwrite-mode=skip"
			],
			{ nodeId: nodeIdentityJson?.did }
		);
		await executeCliCommand(
			[
				"vault-key-create",
				`--load-env=${OUTPUT_TMP_DIR}node-identity.env`,
				"--identity=!NODE_DID",
				"--key-id=test-overwrite-key",
				"--key-type=Ed25519",
				"--overwrite-mode=overwrite",
				`--output-json=${OUTPUT_TMP_DIR}vault-key-overwrite-test.json`
			],
			{ nodeId: nodeIdentityJson?.did }
		);

		const overwriteKeyJson = await CLIUtils.readJsonFile<any>(
			`${OUTPUT_TMP_DIR}vault-key-overwrite-test.json`
		);
		expect(overwriteKeyJson?.keyType).toEqual("Ed25519");
		expect(overwriteKeyJson?.privateKeyHex).toBeDefined();
		expect(overwriteKeyJson?.publicKeyHex).toBeDefined();
	});

	test("identity-verification-method-create throws with overwrite-mode error when method already exists", async () => {
		await expect(
			executeCliCommand(
				[
					"identity-verification-method-create",
					`--load-env=${OUTPUT_TMP_DIR}node-identity.env,${OUTPUT_TMP_DIR}organization-identity.env`,
					"--identity=!ORGANIZATION_DID",
					"--controller=!NODE_DID",
					"--verification-method-id=!TWIN_ATTESTATION_VERIFICATION_METHOD_ID",
					"--overwrite-mode=error"
				],
				{},
				undefined,
				{ disableProcessExitOnFailure: true }
			)
		).rejects.toThrow();
	});

	test("identity-verification-method-create recreates method with overwrite-mode overwrite", async () => {
		await executeCliCommand(
			[
				"identity-verification-method-create",
				`--load-env=${OUTPUT_TMP_DIR}node-identity.env,${OUTPUT_TMP_DIR}organization-identity.env`,
				"--identity=!ORGANIZATION_DID",
				"--controller=!NODE_DID",
				"--verification-method-id=!TWIN_ATTESTATION_VERIFICATION_METHOD_ID",
				"--overwrite-mode=overwrite",
				`--output-json=${OUTPUT_TMP_DIR}organization-attestation-overwrite.json`
			],
			{}
		);

		const attestationJson = await CLIUtils.readJsonFile<any>(
			`${OUTPUT_TMP_DIR}organization-attestation-overwrite.json`
		);
		expect(attestationJson?.verificationMethodId).toEqual(
			`${organizationIdentityJson.did}#attestation-assertion`
		);
		expect(attestationJson?.privateKeyHex).toBeDefined();
		expect(attestationJson?.publicKeyHex).toBeDefined();
	});

	// set-node-org-id

	test("Can set the node organization ID", async () => {
		const state = await executeCliCommand(
			["set-node-org-id", `--organization-id=${organizationIdentityJson.did}`],
			{},
			{ TWIN_TENANT_ENABLED: "false" }
		);
		expect(state.nodeOrganizationId).toEqual(organizationIdentityJson.did);
	});

	test("set-node-org-id throws in multi-tenant mode", async () => {
		await expect(
			executeCliCommand(
				["set-node-org-id", `--organization-id=${organizationIdentityJson.did}`],
				{},
				{},
				{ disableProcessExitOnFailure: true }
			)
		).rejects.toThrow();
	});

	// set-tenant-org-id

	test("Can set the tenant organization ID", async () => {
		await executeCliCommand(
			[
				"set-tenant-org-id",
				`--tenant-id=${nodeTenantJson.tenantId}`,
				`--organization-id=${organizationIdentityJson.did}`
			],
			{ nodeId: nodeIdentityJson.did }
		);

		const dbTable = await CLIUtils.readJsonFile<any[]>(`${OUTPUT_TMP_DIR}db/tenant/store.json`);
		const tenant = dbTable?.find(t => t?.id === nodeTenantJson.tenantId);
		expect(tenant?.organizationId).toEqual(organizationIdentityJson.did);
		expect(tenant?.organizationIdLegacy).toBeUndefined();
	});

	test("set-tenant-org-id moves existing organization ID to legacy on update", async () => {
		await executeCliCommand(
			[
				"set-tenant-org-id",
				`--tenant-id=${nodeTenantJson.tenantId}`,
				`--organization-id=${nodeIdentityJson.did}`
			],
			{ nodeId: nodeIdentityJson.did }
		);

		const dbTable = await CLIUtils.readJsonFile<any[]>(`${OUTPUT_TMP_DIR}db/tenant/store.json`);
		const tenant = dbTable?.find(t => t?.id === nodeTenantJson.tenantId);
		expect(tenant?.organizationId).toEqual(nodeIdentityJson.did);
		expect(tenant?.organizationIdLegacy).toEqual(`|${organizationIdentityJson.did}|`);
	});

	test("set-tenant-org-id removes updated ID from legacy if already present", async () => {
		await executeCliCommand(
			[
				"set-tenant-org-id",
				`--tenant-id=${nodeTenantJson.tenantId}`,
				`--organization-id=${organizationIdentityJson.did}`
			],
			{ nodeId: nodeIdentityJson.did }
		);

		const dbTable = await CLIUtils.readJsonFile<any[]>(`${OUTPUT_TMP_DIR}db/tenant/store.json`);
		const tenant = dbTable?.find(t => t?.id === nodeTenantJson.tenantId);
		expect(tenant?.organizationId).toEqual(organizationIdentityJson.did);
		expect(tenant?.organizationIdLegacy).toEqual(`|${nodeIdentityJson.did}|`);
	});

	test("set-tenant-org-id throws when multi-tenant is not enabled", async () => {
		await expect(
			executeCliCommand(
				[
					"set-tenant-org-id",
					`--tenant-id=${nodeTenantJson.tenantId}`,
					`--organization-id=${organizationIdentityJson.did}`
				],
				{ nodeId: nodeIdentityJson.did },
				{ TWIN_TENANT_ENABLED: "false" },
				{ disableProcessExitOnFailure: true }
			)
		).rejects.toThrow();
	});

	// remove-tenant-org-alias
	// Prerequisite: after "set-tenant-org-id removes updated ID from legacy if already present",
	// the tenant has organizationId=organizationIdentityJson.did and organizationIdLegacy=[nodeIdentityJson.did]

	test("Can remove an alias from the tenant organization legacy list", async () => {
		await executeCliCommand(
			[
				"remove-tenant-org-alias",
				`--tenant-id=${nodeTenantJson.tenantId}`,
				`--alias=${nodeIdentityJson.did}`
			],
			{ nodeId: nodeIdentityJson.did }
		);

		const dbTable = await CLIUtils.readJsonFile<any[]>(`${OUTPUT_TMP_DIR}db/tenant/store.json`);
		const tenant = dbTable?.find(t => t?.id === nodeTenantJson.tenantId);
		expect(tenant?.organizationIdLegacy).toBeUndefined();
		expect(tenant?.organizationId).toEqual(organizationIdentityJson.did);
	});

	test("remove-tenant-org-alias throws when alias is not found", async () => {
		await expect(
			executeCliCommand(
				[
					"remove-tenant-org-alias",
					`--tenant-id=${nodeTenantJson.tenantId}`,
					`--alias=${nodeIdentityJson.did}`
				],
				{ nodeId: nodeIdentityJson.did },
				{},
				{ disableProcessExitOnFailure: true }
			)
		).rejects.toThrow();
	});

	test("remove-tenant-org-alias throws when multi-tenant is not enabled", async () => {
		await expect(
			executeCliCommand(
				[
					"remove-tenant-org-alias",
					`--tenant-id=${nodeTenantJson.tenantId}`,
					`--alias=${organizationIdentityJson.did}`
				],
				{ nodeId: nodeIdentityJson.did },
				{ TWIN_TENANT_ENABLED: "false" },
				{ disableProcessExitOnFailure: true }
			)
		).rejects.toThrow();
	});

	// identity-create with org ID flags

	test("identity-create with --node-organization-id sets the node organization ID", async () => {
		const state = await executeCliCommand(
			[
				"identity-create",
				"--node-organization-id=true",
				`--output-json=${OUTPUT_TMP_DIR}node-org-id-identity.json`
			],
			{},
			{ TWIN_TENANT_ENABLED: "false" }
		);

		const identityJson = await CLIUtils.readJsonFile<any>(
			`${OUTPUT_TMP_DIR}node-org-id-identity.json`
		);
		expect(state.nodeOrganizationId).toEqual(identityJson?.did);
	});

	test("identity-create with --tenant-organization-id sets the tenant organization ID", async () => {
		await executeCliCommand(
			[
				"identity-create",
				`--tenant-organization-id=${nodeTenantJson.tenantId}`,
				`--output-json=${OUTPUT_TMP_DIR}tenant-org-id-identity.json`
			],
			{ nodeId: nodeIdentityJson.did }
		);

		const identityJson = await CLIUtils.readJsonFile<any>(
			`${OUTPUT_TMP_DIR}tenant-org-id-identity.json`
		);
		const dbTable = await CLIUtils.readJsonFile<any[]>(`${OUTPUT_TMP_DIR}db/tenant/store.json`);
		const tenant = dbTable?.find(t => t?.id === nodeTenantJson.tenantId);
		expect(tenant?.organizationId).toEqual(identityJson?.did);
	});

	test("Can re-create a verification method when vault key is missing in skip mode", async () => {
		// Remove the trust-assertion vault key to simulate vault/identity desync
		const vaultKeyStorePath = `${OUTPUT_TMP_DIR}db/vault-key/store.json`;
		const vaultKeysRaw = await readFile(vaultKeyStorePath, "utf8");
		const vaultKeys = JSON.parse(vaultKeysRaw);

		const trustKey = vaultKeys.find((k: { id: string }) => k.id.includes("trust-assertion"));
		expect(trustKey).toBeDefined();

		const filteredKeys = vaultKeys.filter((k: { id: string }) => !k.id.includes("trust-assertion"));
		await writeFile(vaultKeyStorePath, JSON.stringify(filteredKeys, undefined, "\t"));

		// Re-run with --overwrite-mode=skip - should detect missing vault key and re-create it
		await executeCliCommand(
			[
				"identity-verification-method-create",
				`--load-env=${OUTPUT_TMP_DIR}node-identity.env,${OUTPUT_TMP_DIR}organization-identity.env`,
				"--identity=!ORGANIZATION_DID",
				"--controller=!NODE_DID",
				"--verification-method-id=!TWIN_TRUST_VERIFICATION_METHOD_ID",
				"--overwrite-mode=skip",
				`--output-json=${OUTPUT_TMP_DIR}organization-trust-recovered.json`
			],
			{}
		);

		const recoveredJson = await CLIUtils.readJsonFile<any>(
			`${OUTPUT_TMP_DIR}organization-trust-recovered.json`
		);
		expect(recoveredJson?.verificationMethodId).toEqual(
			`${organizationIdentityJson.did}#trust-assertion`
		);

		// Verify the vault key was re-created
		const vaultKeysAfter = JSON.parse(await readFile(vaultKeyStorePath, "utf8"));
		const recoveredKey = vaultKeysAfter.find((k: { id: string }) =>
			k.id.includes("trust-assertion")
		);
		expect(recoveredKey).toBeDefined();
	});
});
