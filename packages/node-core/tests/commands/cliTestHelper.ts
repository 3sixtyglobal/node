// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { readFile, rm } from "node:fs/promises";
import { CLIUtils } from "@3sixty/cli-core";
import { Factory } from "@3sixty/core";
import { MemoryStateStorage } from "@3sixty/engine-core";
import { AuthenticationAdminComponentType } from "@3sixty/engine-server-types";
import {
	EntityStorageConnectorType,
	FaucetConnectorType,
	IdentityConnectorType,
	IdentityProfileConnectorType,
	IdentityResolverConnectorType,
	VaultConnectorType,
	WalletConnectorType
} from "@3sixty/engine-types";
import type { INodeEngineState } from "../../src/models/INodeEngineState.js";
import { run } from "../../src/node.js";
import { CI_ENV_VARS, getFreePort } from "../setupTestEnv.js";

/**
 * The tenancy modes every command is tested in.
 */
export const TENANT_MODES = [
	{ mode: "single-tenant", tenantEnabled: false },
	{ mode: "multi-tenant", tenantEnabled: true }
];

/**
 * A well formed tenant ID that does not exist.
 */
export const UNKNOWN_TENANT_ID = "0123456789abcdef0123456789abcdef";

/**
 * A well formed DID that does not exist.
 */
export const UNKNOWN_DID =
	"did:entity-storage:0x0000000000000000000000000000000000000000000000000000000000000001";

/**
 * The error raised by tenant commands when multi-tenancy is disabled.
 */
export const TENANT_ADMIN_NOT_REGISTERED = "tenantAdminComponentNotRegistered";

/**
 * The root folder for command test output.
 */
export const OUTPUT_TMP_DIR = "./tests/.tmp/commands/";

/**
 * Extract the value from a line of an .env file.
 * @param line The line to extract the value from.
 * @returns The value without quotes.
 */
export function valueFromEnv(line?: string): string | undefined {
	return line?.split("=").slice(1).join("=").replace(/"/g, "");
}

/**
 * Read the records from a file entity storage store.
 * @param dbDir The storage root folder.
 * @param entityType The kebab case entity type.
 * @returns The records, or an empty list if the store does not exist.
 */
export async function readStoreRecords<T>(dbDir: string, entityType: string): Promise<T[]> {
	try {
		const content = await readFile(`${dbDir}/${entityType}/store.json`, "utf8");
		return JSON.parse(content) as T[];
	} catch {
		return [];
	}
}

/**
 * Execute a CLI command against file storage.
 * @param args The CLI args.
 * @param options The options for the execution.
 * @param options.state The node state, mutated by the command.
 * @param options.dbDir The storage root folder.
 * @param options.tenantEnabled Whether multi-tenancy is enabled.
 * @param options.envVars Additional environment variables.
 * @returns The state after the command.
 */
export async function executeCliCommand(
	args: string[],
	options: {
		state: INodeEngineState;
		dbDir: string;
		tenantEnabled: boolean;
		envVars?: { [key: string]: string };
	}
): Promise<INodeEngineState> {
	const port = await getFreePort();
	await run(
		{
			localesDirectory: "./dist/locales/",
			stateStorage: new MemoryStateStorage(false, options.state),
			disableProcessExitOnFailure: true,
			envVars: {
				TWIN_ENV_ALLOW_LIST: CI_ENV_VARS,
				TWIN_SILENT: "true",
				TWIN_TENANT_ENABLED: options.tenantEnabled ? "true" : "false",
				TWIN_PORT: port.toString(),
				TWIN_STORAGE_FILE_ROOT: options.dbDir,
				TWIN_ENTITY_STORAGE_CONNECTOR_TYPE: EntityStorageConnectorType.File,
				TWIN_VAULT_CONNECTOR: VaultConnectorType.EntityStorage,
				TWIN_IDENTITY_CONNECTOR: IdentityConnectorType.EntityStorage,
				TWIN_IDENTITY_RESOLVER_CONNECTOR: IdentityResolverConnectorType.EntityStorage,
				TWIN_IDENTITY_PROFILE_CONNECTOR: IdentityProfileConnectorType.EntityStorage,
				TWIN_FAUCET_CONNECTOR: FaucetConnectorType.EntityStorage,
				TWIN_WALLET_CONNECTOR: WalletConnectorType.EntityStorage,
				TWIN_AUTH_ADMIN_PROCESSOR_TYPE: AuthenticationAdminComponentType.EntityStorage,
				...options.envVars
			}
		},
		["node", "index.js", ...args]
	);
	return options.state;
}

/**
 * A node bootstrapped in one tenancy mode, for testing a command against.
 */
export interface ICliTestContext {
	/**
	 * The folder for the output of the tests.
	 */
	dir: string;

	/**
	 * The storage root folder.
	 */
	dbDir: string;

	/**
	 * Whether multi-tenancy is enabled.
	 */
	tenantEnabled: boolean;

	/**
	 * The node state.
	 */
	state: INodeEngineState;

	/**
	 * The organization DID, the node organization or the organization of the bootstrap tenant.
	 */
	organizationId: string;

	/**
	 * The ID of the bootstrap tenant in multi-tenant mode.
	 */
	tenantId?: string;

	/**
	 * Execute a command against the node.
	 * @param args The CLI args.
	 * @param envVars Additional environment variables.
	 * @param state Override the node state.
	 * @returns The state after the command.
	 */
	execute(
		args: string[],
		envVars?: { [key: string]: string },
		state?: INodeEngineState
	): Promise<INodeEngineState>;

	/**
	 * The tenant ID arguments that are valid for the mode.
	 * @returns The arguments.
	 */
	tenantArgs(): string[];

	/**
	 * The tenant ID arguments that are invalid for the mode, and the error they raise.
	 * @returns The arguments and the error.
	 */
	wrongTenantArgs(): { args: string[]; error: string };

	/**
	 * Run a command that is only available in multi-tenant mode, expecting it to fail in single-tenant mode.
	 * @param args The CLI args.
	 * @returns A promise that resolves when the expectation has been met.
	 */
	expectMultiTenantOnly(args: string[]): Promise<void>;

	/**
	 * Create a new identity.
	 * @param name A unique name used for the output file.
	 * @returns The DID and mnemonic of the identity.
	 */
	createIdentity(name: string): Promise<{ did: string; mnemonic: string }>;

	/**
	 * Create a new user with a new identity in the organization.
	 * @param email The email address for the user.
	 * @returns The DID, email and password of the user.
	 */
	createUser(email: string): Promise<{ did: string; email: string; password: string }>;
}

/**
 * Register the hooks that bootstrap a node for the tests of a command in one tenancy mode.
 * @param command The command being tested, used for the output folder.
 * @param mode The name of the tenancy mode.
 * @param tenantEnabled Whether multi-tenancy is enabled.
 * @returns The context, populated once the bootstrap has run.
 */
export function setupCliTestContext(
	command: string,
	mode: string,
	tenantEnabled: boolean
): ICliTestContext {
	const dir = `${OUTPUT_TMP_DIR}${command}/${mode}/`;

	const context: ICliTestContext = {
		dir,
		dbDir: `${dir}db`,
		tenantEnabled,
		state: {},
		organizationId: "",
		execute: async (args, envVars, state) =>
			executeCliCommand(args, {
				state: state ?? context.state,
				dbDir: context.dbDir,
				tenantEnabled,
				envVars
			}),
		tenantArgs: () => (tenantEnabled ? [`--tenant-id=${context.tenantId}`] : []),
		wrongTenantArgs: () => {
			if (tenantEnabled) {
				return { args: [], error: "tenantIdRequired" };
			}
			return { args: [`--tenant-id=${UNKNOWN_TENANT_ID}`], error: "tenantIdNotAllowed" };
		},
		expectMultiTenantOnly: async args => {
			if (tenantEnabled) {
				await context.execute(args);
			} else {
				await expect(context.execute(args)).rejects.toThrow(TENANT_ADMIN_NOT_REGISTERED);
			}
		},
		createIdentity: async name => {
			const outputJson = `${dir}${name}.json`;
			await context.execute(["identity-create", `--output-json=${outputJson}`]);
			const json = await CLIUtils.readJsonFile<{ did: string; mnemonic: string }>(outputJson);
			return { did: json?.did ?? "", mnemonic: json?.mnemonic ?? "" };
		},
		createUser: async email => {
			const identity = await context.createIdentity(`user-identity-${email}`);
			const outputJson = `${dir}user-${email}.json`;
			await context.execute([
				"user-create",
				`--user-identity=${identity.did}`,
				`--organization-identity=${context.organizationId}`,
				`--email=${email}`,
				`--output-json=${outputJson}`,
				...context.tenantArgs()
			]);
			const json = await CLIUtils.readJsonFile<{ password: string }>(outputJson);
			return { did: identity.did, email, password: json?.password ?? "" };
		}
	};

	beforeAll(async () => {
		await rm(dir, { recursive: true, force: true });
		Factory.clearFactories();

		await context.execute(["bootstrap-dev"], { TWIN_FEATURES: "wallet,admin-user" });

		if (tenantEnabled) {
			const tenants = await readStoreRecords<{ id: string; organizationId: string }>(
				context.dbDir,
				"tenant"
			);
			context.tenantId = tenants[0]?.id;
			context.organizationId = tenants[0]?.organizationId ?? "";
		} else {
			context.organizationId = context.state.nodeOrganizationId ?? "";
		}
	});

	beforeEach(() => {
		Factory.clearFactories();
	});

	return context;
}
