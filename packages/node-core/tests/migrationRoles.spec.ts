// Copyright 2026 IOTA Stiftung.
// Copyright 2026 3Sixty Trade Ltd.
// SPDX-License-Identifier: Apache-2.0.
import { type AccountData, initSchema } from "@3sixty/api-auth-account-service";
import type { IAuthorizationComponent } from "@3sixty/authorization-models";
import { ContextIdStore } from "@3sixty/context";
import { ComponentFactory, Factory, GeneralError } from "@3sixty/core";
import type { IEngineCore } from "@3sixty/engine-models";
import type { IEntitySchemaProperty } from "@3sixty/entity";
import { MemoryEntityStorageConnector } from "@3sixty/entity-storage-connector-memory";
import {
	EntityStorageConnectorFactory,
	SchemaMigrationFactory,
	type ISchemaMigration
} from "@3sixty/entity-storage-models";
import { AUTHORIZATION_MODEL_ID } from "../src/defaults.js";
import { finalizeMigrations, initialiseMigrations } from "../src/migration.js";

const MIGRATION_KEY = "AuthenticationUser_0_1";
const AUTH_COMPONENT_TYPE = "test-authorization-component";
const SCOPE_PROP = [{ property: "scope" } as unknown as IEntitySchemaProperty];

type RemoveEntityPropertyFn = NonNullable<ISchemaMigration["removeEntityProperty"]>;

describe("migration of v0 user scopes to roles", () => {
	let accountData: MemoryEntityStorageConnector<AccountData>;
	let addRoleForSubject: ReturnType<typeof vi.fn>;
	let engineCore: IEngineCore;
	let removeEntityProperty: RemoveEntityPropertyFn;

	/**
	 * Run the v0 to v1 migration for a user in the node partition.
	 * @param email The e-mail address of the user.
	 * @param scope The scope of the user.
	 * @param removed The properties being removed.
	 */
	async function migrateUser(
		email: string,
		scope: string,
		removed: IEntitySchemaProperty[] = SCOPE_PROP
	): Promise<void> {
		await ContextIdStore.run({ node: "test-node" }, async () =>
			removeEntityProperty({ email, identity: `did:twin:${email}`, scope }, removed)
		);
	}

	/**
	 * Get the roles assigned to each subject.
	 * @returns The roles by subject.
	 */
	function assignedRoles(): { [subject: string]: string[] } {
		const roles: { [subject: string]: string[] } = {};
		for (const [, subject, role] of addRoleForSubject.mock.calls as [string, string, string][]) {
			roles[subject] = [...(roles[subject] ?? []), role].sort();
		}
		return roles;
	}

	beforeEach(() => {
		Factory.clearFactories();
		initSchema();
		accountData = new MemoryEntityStorageConnector<AccountData>({
			entitySchema: "AccountData",
			config: { storageKey: "account-data" }
		});
		EntityStorageConnectorFactory.register("account-data", () => accountData);

		addRoleForSubject = vi.fn().mockResolvedValue(undefined);
		ComponentFactory.register(
			AUTH_COMPONENT_TYPE,
			() => ({ addRoleForSubject }) as unknown as IAuthorizationComponent
		);
		engineCore = {
			getContextIds: () => ({ node: "test-node" }),
			getRegisteredInstanceTypeOptional: vi.fn().mockReturnValue(undefined),
			getRegisteredInstanceType: vi.fn().mockReturnValue(AUTH_COMPONENT_TYPE)
		} as unknown as IEngineCore;

		initialiseMigrations(engineCore, {});
		const migration = SchemaMigrationFactory.get(MIGRATION_KEY);
		if (!migration.removeEntityProperty) {
			throw new Error("removeEntityProperty not registered on migration");
		}
		removeEntityProperty = migration.removeEntityProperty;
	});

	test("does not register the migrations when schema migration is disabled", () => {
		SchemaMigrationFactory.clear();
		initialiseMigrations(engineCore, { schemaMigrationEnabled: "false" });
		expect(SchemaMigrationFactory.names()).toHaveLength(0);
	});

	test("does nothing when the scope is not being removed", async () => {
		await migrateUser("user1@test.com", "admin", []);
		await migrateUser("user1@test.com", "admin", [
			{ property: "password" } as unknown as IEntitySchemaProperty
		]);
		await finalizeMigrations(engineCore, {});

		expect(addRoleForSubject).not.toHaveBeenCalled();
		expect(await accountData.getStore()).toHaveLength(0);
	});

	test("assigns each role of the scope to the account of the user, not its DID", async () => {
		await migrateUser("user1@test.com", "global-admin,user-admin");
		await finalizeMigrations(engineCore, {});

		const roles = assignedRoles();
		expect(Object.values(roles)).toEqual([["global-admin", "user-admin"]]);
		expect(Object.keys(roles)[0]).not.toContain("did:");
		expect(addRoleForSubject.mock.calls.every(call => call[0] === AUTHORIZATION_MODEL_ID)).toBe(
			true
		);
	});

	test("trims and lower cases the roles", async () => {
		await migrateUser("user1@test.com", " ADMIN , User ");
		await finalizeMigrations(engineCore, {});

		expect(Object.values(assignedRoles())).toEqual([["admin", "user"]]);
	});

	test.each(["", "  ,  "])("falls back to the user role for the scope '%s'", async scope => {
		await migrateUser("user1@test.com", scope);
		await finalizeMigrations(engineCore, {});

		expect(Object.values(assignedRoles())).toEqual([["user"]]);
	});

	test("adds the devops and identity admin roles to a tenant and user admin", async () => {
		await migrateUser("user1@test.com", "tenant-admin,user-admin");
		await finalizeMigrations(engineCore, {});

		expect(Object.values(assignedRoles())).toEqual([
			["devops", "identity-admin", "identity-profile-admin", "tenant-admin", "user-admin"]
		]);
	});

	test("gives each user its own account", async () => {
		await migrateUser("user1@test.com", "global-admin");
		await migrateUser("user2@test.com", "tenant-admin");
		await finalizeMigrations(engineCore, {});

		expect(Object.values(assignedRoles()).sort()).toEqual([["global-admin"], ["tenant-admin"]]);
	});

	test("keeps the account id when the migration runs again for the same user", async () => {
		await migrateUser("User1@Test.com", "admin");
		await migrateUser("User1@Test.com", "admin");
		await finalizeMigrations(engineCore, {});

		expect(Object.keys(assignedRoles())).toHaveLength(1);
	});

	test("gives users whose e-mail addresses differ only by case their own accounts", async () => {
		await migrateUser("User1@Test.com", "admin");
		await migrateUser("user1@test.com", "user");
		await finalizeMigrations(engineCore, {});

		expect(Object.values(assignedRoles()).sort()).toEqual([["admin"], ["user"]]);
	});

	test("uses the authorization model id from the environment", async () => {
		await migrateUser("user1@test.com", "admin");
		await finalizeMigrations(engineCore, { authorizationModelId: "custom-model" });

		expect(addRoleForSubject).toHaveBeenCalledWith("custom-model", expect.any(String), "admin");
	});

	test("removes the completed work so a second run assigns nothing", async () => {
		await migrateUser("user1@test.com", "admin");
		await finalizeMigrations(engineCore, {});
		expect(addRoleForSubject).toHaveBeenCalledTimes(1);
		expect(await accountData.getStore()).toHaveLength(0);

		addRoleForSubject.mockClear();
		await finalizeMigrations(engineCore, {});
		expect(addRoleForSubject).not.toHaveBeenCalled();
	});

	test("fails and keeps the work when no authorization component is registered", async () => {
		await migrateUser("user1@test.com", "admin");
		const noAuthorization = {
			...engineCore,
			getRegisteredInstanceType: vi.fn().mockImplementation(() => {
				throw new GeneralError("node", "componentNotFound");
			})
		} as unknown as IEngineCore;

		await expect(finalizeMigrations(noAuthorization, {})).rejects.toBeInstanceOf(GeneralError);
		expect(await accountData.getStore()).toHaveLength(1);
	});

	test("does nothing without the account data storage or when schema migration is disabled", async () => {
		await migrateUser("user1@test.com", "admin");
		await finalizeMigrations(engineCore, { schemaMigrationEnabled: "false" });
		EntityStorageConnectorFactory.unregister("account-data");
		await finalizeMigrations(engineCore, {});

		expect(addRoleForSubject).not.toHaveBeenCalled();
	});

	test("fails when the account data storage is missing while migrating", async () => {
		EntityStorageConnectorFactory.unregister("account-data");

		await expect(migrateUser("user1@test.com", "admin")).rejects.toThrow(
			"migrationAccountDataMissing"
		);
	});
});
