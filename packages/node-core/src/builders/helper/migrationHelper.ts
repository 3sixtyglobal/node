// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type {
	AuthenticationUser,
	AuthenticationUserV0
} from "@twin.org/api-auth-entity-storage-service";
import type { IAuthorizationComponent } from "@twin.org/authorization-models";
import { ContextIdStore, type IContextIds } from "@twin.org/context";
import { Is, ComponentFactory } from "@twin.org/core";
import type { IEngineCore } from "@twin.org/engine-models";
import type { IEntitySchemaProperty } from "@twin.org/entity";
import type { ISchemaMigration } from "@twin.org/entity-storage-models";
import { SchemaMigrationFactory } from "@twin.org/entity-storage-models";
import { nameof } from "@twin.org/nameof";
import { envBoolean, envString } from "./envHelpers.js";
import {
	AUTHORIZATION_MODEL_ID,
	DEFAULT_DEVOPS_ROLE,
	DEFAULT_TENANT_ADMIN_ROLE,
	DEFAULT_USER_ADMIN_ROLE,
	DEFAULT_IDENTITY_PROFILE_ADMIN_ROLE,
	DEFAULT_USER_ROLE,
	DEFAULT_IDENTITY_ADMIN_ROLE
} from "../../defaults.js";
import type { IEnvironmentVariables } from "../../models/IEnvironmentVariables.js";

const migrateRoles: { identity: string; roles: string[]; contextIds: IContextIds | undefined }[] =
	[];

/**
 * Initialise schema migrations for the engine.
 * @param engineCore The engine core instance.
 * @param envVars The environment variables.
 */
export function initialiseMigrations(
	engineCore: IEngineCore,
	envVars: IEnvironmentVariables
): void {
	if (!envBoolean(envVars, "schemaMigrationEnabled", true)) {
		return;
	}

	const migrationV0V1: ISchemaMigration<AuthenticationUserV0, AuthenticationUser> = {
		removeEntityProperty: async (
			entity: AuthenticationUserV0,
			removedProperties: IEntitySchemaProperty<AuthenticationUserV0>[]
		): Promise<void> => {
			// If the scope property is not being removed, we don't need to do anything
			if (removedProperties.find(prop => prop.property === "scope") === undefined) {
				return;
			}

			let roles: string[] = [];
			if (Is.stringValue(entity.scope)) {
				roles = entity.scope
					.split(",")
					.map(role => role.trim().toLocaleLowerCase())
					.filter(role => role.length > 0);
			}
			if (roles.length === 0) {
				roles.push(DEFAULT_USER_ROLE);
			}

			// If the user has both tenant-admin and user-admin roles, we also add the new roles
			// to provide access to everything they had before
			if (roles.includes(DEFAULT_TENANT_ADMIN_ROLE) && roles.includes(DEFAULT_USER_ADMIN_ROLE)) {
				roles.push(DEFAULT_DEVOPS_ROLE);
				roles.push(DEFAULT_IDENTITY_ADMIN_ROLE);
				roles.push(DEFAULT_IDENTITY_PROFILE_ADMIN_ROLE);
			}

			// We need to store the old roles in here if a migration is performed
			// they will be picked up by the start method of the AuthenticationService
			// and used to populate the new roles table in the correct partition.
			// The same identity can exist across multiple partitions so we accumulate
			// entries as an array keyed by contextIds rather than by identity alone.
			const contextIds: IContextIds | undefined = await ContextIdStore.getContextIds();
			migrateRoles.push({
				identity: entity.identity,
				roles,
				contextIds
			});
		}
	};
	SchemaMigrationFactory.register(
		`${nameof<AuthenticationUser>()}_0_1`,
		() => migrationV0V1 as ISchemaMigration
	);
}

/**
 * Finalize schema migrations by clearing any temporary data stored in the shared store.
 * This should be called after all migrations have been processed to ensure that
 * any temporary data used during the migration process is removed.
 * @param engineCore The engine core instance.
 * @param envVars The environment variables.
 */
export async function finalizeMigrations(
	engineCore: IEngineCore,
	envVars: IEnvironmentVariables
): Promise<void> {
	if (Is.arrayValue(migrateRoles)) {
		// If a migration of the roles from the old authenticated users has just happened
		// the old roles will be stored in the SharedStore, if they exist then we need
		// to populate them in the authorization service.
		const authComponentType = engineCore.getRegisteredInstanceType("authorizationComponent");

		const authorizationComponent = ComponentFactory.get<IAuthorizationComponent>(authComponentType);

		const migrationModelId = envString(envVars, "authorizationModelId", AUTHORIZATION_MODEL_ID);

		for (const entry of migrateRoles) {
			await ContextIdStore.run(entry.contextIds ?? {}, async () => {
				for (const role of entry.roles) {
					await authorizationComponent.addRoleForSubject(migrationModelId, entry.identity, role);
				}
			});
		}
		migrateRoles.length = 0;
	}
}
