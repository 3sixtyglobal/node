// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IAuthorizationComponent } from "@twin.org/authorization-models";
import { ContextIdStore } from "@twin.org/context";
import { ComponentFactory, GeneralError } from "@twin.org/core";
import type { IEngineCore } from "@twin.org/engine-models";
import type { IEntitySchemaProperty } from "@twin.org/entity";
import type { ISchemaMigration } from "@twin.org/entity-storage-models";
import { SchemaMigrationFactory } from "@twin.org/entity-storage-models";
import {
	finalizeMigrations,
	initialiseMigrations
} from "../../../src/builders/helper/migrationHelper.js";
import { AUTHORIZATION_MODEL_ID } from "../../../src/defaults.js";

const MIGRATION_KEY = "AuthenticationUser_0_1";
const AUTH_COMPONENT_TYPE = "test-authorization-component";

type RemoveEntityPropertyFn = NonNullable<ISchemaMigration["removeEntityProperty"]>;

const SCOPE_PROP = [{ property: "scope" } as unknown as IEntitySchemaProperty];

describe("initialiseMigrations", () => {
	let callRemoveEntityProperty: RemoveEntityPropertyFn;
	let mockEngineCore: IEngineCore;
	let mockAddRoleForSubject: ReturnType<typeof vi.fn>;
	let getRegisteredInstanceTypeOptional: ReturnType<typeof vi.fn>;

	beforeAll(() => {
		getRegisteredInstanceTypeOptional = vi.fn().mockReturnValue(AUTH_COMPONENT_TYPE);
		mockEngineCore = {
			getRegisteredInstanceTypeOptional,
			getRegisteredInstanceType: vi.fn().mockReturnValue(AUTH_COMPONENT_TYPE)
		} as unknown as IEngineCore;

		mockAddRoleForSubject = vi.fn().mockResolvedValue(undefined);
		ComponentFactory.register(
			AUTH_COMPONENT_TYPE,
			() =>
				({
					addRoleForSubject: mockAddRoleForSubject
				}) as unknown as IAuthorizationComponent
		);

		initialiseMigrations(mockEngineCore, {});
		const migration = SchemaMigrationFactory.get(MIGRATION_KEY);
		const { removeEntityProperty } = migration;
		if (!removeEntityProperty) {
			throw new Error("removeEntityProperty not registered on migration");
		}
		callRemoveEntityProperty = removeEntityProperty;
	});

	afterAll(() => {
		try {
			SchemaMigrationFactory.unregister(MIGRATION_KEY);
		} catch {
			// Ignore if already removed.
		}
		try {
			ComponentFactory.unregister(AUTH_COMPONENT_TYPE);
		} catch {
			// Ignore if already removed.
		}
	});

	afterEach(async () => {
		// Drain any queued roles accumulated during the test to prevent cross-test pollution.
		await finalizeMigrations(mockEngineCore, {});
		mockAddRoleForSubject.mockClear();
	});

	test("registers the AuthenticationUser_0_1 migration with SchemaMigrationFactory", () => {
		expect(typeof callRemoveEntityProperty).toBe("function");
	});

	test("removeEntityProperty is a no-op when scope is not in removedProperties", async () => {
		await callRemoveEntityProperty({ identity: "did:twin:user1", scope: "admin" }, []);
		await finalizeMigrations(mockEngineCore, {});
		expect(mockAddRoleForSubject).not.toHaveBeenCalled();
	});

	test("removeEntityProperty is a no-op when removedProperties contains other fields but not scope", async () => {
		await callRemoveEntityProperty({ identity: "did:twin:user1", scope: "admin" }, [
			{ property: "password" } as unknown as IEntitySchemaProperty
		]);
		await finalizeMigrations(mockEngineCore, {});
		expect(mockAddRoleForSubject).not.toHaveBeenCalled();
	});

	test("initialiseMigrations is a no-op when schema migration is disabled", () => {
		SchemaMigrationFactory.clear();
		initialiseMigrations(mockEngineCore, { schemaMigrationEnabled: "false" });
		expect(SchemaMigrationFactory.names()).toHaveLength(0);
	});

	test("removeEntityProperty splits comma-separated scope into individual roles", async () => {
		await ContextIdStore.run({ node: "test-node" }, async () => {
			await callRemoveEntityProperty(
				{ identity: "did:twin:user1", scope: "global-admin,user-admin" },
				SCOPE_PROP
			);
		});
		await finalizeMigrations(mockEngineCore, {});
		expect(mockAddRoleForSubject).toHaveBeenCalledTimes(2);
		expect(mockAddRoleForSubject).toHaveBeenCalledWith(
			AUTHORIZATION_MODEL_ID,
			"did:twin:user1",
			"global-admin"
		);
		expect(mockAddRoleForSubject).toHaveBeenCalledWith(
			AUTHORIZATION_MODEL_ID,
			"did:twin:user1",
			"user-admin"
		);
	});

	test("removeEntityProperty trims whitespace and lowercases roles", async () => {
		await ContextIdStore.run({ node: "test-node" }, async () => {
			await callRemoveEntityProperty(
				{ identity: "did:twin:user1", scope: " ADMIN , User " },
				SCOPE_PROP
			);
		});
		await finalizeMigrations(mockEngineCore, {});
		expect(mockAddRoleForSubject).toHaveBeenCalledTimes(2);
		expect(mockAddRoleForSubject).toHaveBeenCalledWith(
			AUTHORIZATION_MODEL_ID,
			"did:twin:user1",
			"admin"
		);
		expect(mockAddRoleForSubject).toHaveBeenCalledWith(
			AUTHORIZATION_MODEL_ID,
			"did:twin:user1",
			"user"
		);
	});

	test("removeEntityProperty falls back to user role when scope is an empty string", async () => {
		await ContextIdStore.run({ node: "test-node" }, async () => {
			await callRemoveEntityProperty({ identity: "did:twin:user1", scope: "" }, SCOPE_PROP);
		});
		await finalizeMigrations(mockEngineCore, {});
		expect(mockAddRoleForSubject).toHaveBeenCalledTimes(1);
		expect(mockAddRoleForSubject).toHaveBeenCalledWith(
			AUTHORIZATION_MODEL_ID,
			"did:twin:user1",
			"user"
		);
	});

	test("removeEntityProperty falls back to user role when scope contains only whitespace", async () => {
		await ContextIdStore.run({ node: "test-node" }, async () => {
			await callRemoveEntityProperty({ identity: "did:twin:user1", scope: "  ,  " }, SCOPE_PROP);
		});
		await finalizeMigrations(mockEngineCore, {});
		expect(mockAddRoleForSubject).toHaveBeenCalledTimes(1);
		expect(mockAddRoleForSubject).toHaveBeenCalledWith(
			AUTHORIZATION_MODEL_ID,
			"did:twin:user1",
			"user"
		);
	});
});

describe("finalizeMigrations", () => {
	let callRemoveEntityProperty: RemoveEntityPropertyFn;
	let mockEngineCore: IEngineCore;
	let mockAddRoleForSubject: ReturnType<typeof vi.fn>;

	beforeAll(() => {
		mockAddRoleForSubject = vi.fn().mockResolvedValue(undefined);
		ComponentFactory.register(
			`${AUTH_COMPONENT_TYPE}-finalize`,
			() =>
				({
					addRoleForSubject: mockAddRoleForSubject
				}) as unknown as IAuthorizationComponent
		);

		const getRegisteredInstanceTypeOptional = vi
			.fn()
			.mockReturnValue(`${AUTH_COMPONENT_TYPE}-finalize`);
		mockEngineCore = {
			getRegisteredInstanceTypeOptional,
			getRegisteredInstanceType: vi.fn().mockReturnValue(`${AUTH_COMPONENT_TYPE}-finalize`)
		} as unknown as IEngineCore;

		initialiseMigrations(mockEngineCore, {});
		const migration = SchemaMigrationFactory.get(MIGRATION_KEY);
		const { removeEntityProperty } = migration;
		if (!removeEntityProperty) {
			throw new Error("removeEntityProperty not registered on migration");
		}
		callRemoveEntityProperty = removeEntityProperty;
	});

	afterAll(() => {
		try {
			SchemaMigrationFactory.unregister(MIGRATION_KEY);
		} catch {
			// Ignore if already removed.
		}
		try {
			ComponentFactory.unregister(`${AUTH_COMPONENT_TYPE}-finalize`);
		} catch {
			// Ignore if already removed.
		}
	});

	afterEach(async () => {
		// Drain any leftover queued roles.
		await finalizeMigrations(mockEngineCore, {});
		mockAddRoleForSubject.mockClear();
	});

	test("throws when roles are queued but no authorization component is registered", async () => {
		await ContextIdStore.run({ node: "test-node" }, async () => {
			await callRemoveEntityProperty({ identity: "did:twin:user1", scope: "admin" }, SCOPE_PROP);
		});
		const engineCoreNoAuth: IEngineCore = {
			getRegisteredInstanceTypeOptional: vi.fn().mockReturnValue(undefined),
			getRegisteredInstanceType: vi.fn().mockImplementation(() => {
				throw new GeneralError("node", "componentNotFound");
			})
		} as unknown as IEngineCore;
		await expect(finalizeMigrations(engineCoreNoAuth, {})).rejects.toBeInstanceOf(GeneralError);
	});

	test("is a no-op when no roles have been queued", async () => {
		// migrateRoles is empty - drained by afterEach from the previous test.
		await finalizeMigrations(mockEngineCore, {});
		expect(mockAddRoleForSubject).not.toHaveBeenCalled();
	});

	test("calls addRoleForSubject for every queued role", async () => {
		await ContextIdStore.run({ node: "test-node" }, async () => {
			await callRemoveEntityProperty(
				{ identity: "did:twin:user1", scope: "admin,user" },
				SCOPE_PROP
			);
		});
		await finalizeMigrations(mockEngineCore, {});
		expect(mockAddRoleForSubject).toHaveBeenCalledTimes(2);
		expect(mockAddRoleForSubject).toHaveBeenCalledWith(
			AUTHORIZATION_MODEL_ID,
			"did:twin:user1",
			"admin"
		);
		expect(mockAddRoleForSubject).toHaveBeenCalledWith(
			AUTHORIZATION_MODEL_ID,
			"did:twin:user1",
			"user"
		);
	});

	test("processes roles for multiple identities", async () => {
		await ContextIdStore.run({ node: "test-node" }, async () => {
			await callRemoveEntityProperty(
				{ identity: "did:twin:user1", scope: "global-admin" },
				SCOPE_PROP
			);
			await callRemoveEntityProperty(
				{ identity: "did:twin:user2", scope: "tenant-admin" },
				SCOPE_PROP
			);
		});
		await finalizeMigrations(mockEngineCore, {});
		expect(mockAddRoleForSubject).toHaveBeenCalledTimes(2);
		expect(mockAddRoleForSubject).toHaveBeenCalledWith(
			AUTHORIZATION_MODEL_ID,
			"did:twin:user1",
			"global-admin"
		);
		expect(mockAddRoleForSubject).toHaveBeenCalledWith(
			AUTHORIZATION_MODEL_ID,
			"did:twin:user2",
			"tenant-admin"
		);
	});

	test("uses the authorizationModelId env var when provided", async () => {
		await ContextIdStore.run({ node: "test-node" }, async () => {
			await callRemoveEntityProperty({ identity: "did:twin:user1", scope: "admin" }, SCOPE_PROP);
		});
		await finalizeMigrations(mockEngineCore, { authorizationModelId: "custom-model" });
		expect(mockAddRoleForSubject).toHaveBeenCalledWith("custom-model", "did:twin:user1", "admin");
	});

	test("drains the queue so a second call is a no-op", async () => {
		await ContextIdStore.run({ node: "test-node" }, async () => {
			await callRemoveEntityProperty({ identity: "did:twin:user1", scope: "admin" }, SCOPE_PROP);
		});
		await finalizeMigrations(mockEngineCore, {});
		expect(mockAddRoleForSubject).toHaveBeenCalledTimes(1);

		mockAddRoleForSubject.mockClear();
		await finalizeMigrations(mockEngineCore, {});
		expect(mockAddRoleForSubject).not.toHaveBeenCalled();
	});
});
