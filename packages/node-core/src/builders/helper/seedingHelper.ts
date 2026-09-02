// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IBaseRoute, IPlatformComponent, IRouteAuthorization } from "@twin.org/api-models";
import type {
	IAuthorizationComponent,
	IAuthorizationInheritance,
	IAuthorizationModel,
	IAuthorizationPolicy
} from "@twin.org/authorization-models";
import { ContextIdKeys, ContextIdStore } from "@twin.org/context";
import { ComponentFactory, Is } from "@twin.org/core";
import type { IEngineCore, IEngineServer } from "@twin.org/engine-models";
import { HttpMethod } from "@twin.org/web";
import { envChoice, envObject, envString } from "./envHelpers.js";
import {
	AUTHORIZATION_MODEL_ID,
	DEFAULT_ESCALATED_PRIVILEGE_ROLE,
	DEFAULT_USER_ROLE
} from "../../defaults.js";
import { AuthorizationModelMode } from "../../models/authorizationModelMode.js";
import type { IEngineEnvironmentVariables } from "../../models/IEngineEnvironmentVariables.js";

const DEFAULT_AUTHORIZATION_READER: IRouteAuthorization = {
	permission: "user:read",
	role: DEFAULT_USER_ROLE
};

const DEFAULT_AUTHORIZATION_WRITER: IRouteAuthorization = {
	permission: "user:write",
	role: DEFAULT_USER_ROLE,
	inherits: [DEFAULT_AUTHORIZATION_READER.permission]
};

/**
 * Seed default authorization policies and role inheritances after the engine has started.
 * Uses the platform component to execute across all tenants in multi-tenant mode.
 * @param engineCore The running engine core.
 * @param engineServer The running engine server.
 * @param envVars The environment variables.
 */
export async function seedAuthorizationDefaults(
	engineCore: IEngineCore,
	engineServer: IEngineServer,
	envVars: IEngineEnvironmentVariables
): Promise<void> {
	const nodeContextIds = engineCore.getContextIds() ?? {};
	if (!Is.stringValue(nodeContextIds.node)) {
		return;
	}

	const authComponentType = engineCore.getRegisteredInstanceType("authorizationComponent");
	const platformComponentType = engineCore.getRegisteredInstanceType("platformComponent");
	const platformComponent = ComponentFactory.get<IPlatformComponent>(platformComponentType);
	const authorizationComponent = ComponentFactory.get<IAuthorizationComponent>(authComponentType);

	const modelId = envString(envVars, "authorizationModelId", AUTHORIZATION_MODEL_ID);
	const rulesMode = envChoice(
		envVars,
		"authorizationModelMode",
		Object.values(AuthorizationModelMode),
		AuthorizationModelMode.Merge
	);

	const customModel = envObject<IEngineEnvironmentVariables, IAuthorizationModel>(
		envVars,
		"authorizationModel"
	);

	const policies: IAuthorizationPolicy[] = [];
	const roleInheritances: IAuthorizationInheritance[] = [];

	if (Is.objectValue<IAuthorizationModel>(customModel)) {
		policies.push(...(customModel.policies ?? []));

		const escalatedRoles = new Set<string>();
		for (const inheritance of customModel.roleInheritances ?? []) {
			roleInheritances.push(inheritance);
			escalatedRoles.add(inheritance.role);
		}
		for (const role of escalatedRoles) {
			roleInheritances.push({ role: DEFAULT_ESCALATED_PRIVILEGE_ROLE, inheritsFrom: role });
			if (role !== DEFAULT_USER_ROLE) {
				roleInheritances.push({ role, inheritsFrom: DEFAULT_USER_ROLE });
			}
		}
	}

	if (!Is.objectValue(customModel) || rulesMode === AuthorizationModelMode.Merge) {
		const policyKeys = new Set<string>();
		const inheritanceKeys = new Set<string>();
		const roles = new Set<string>();

		for (const route of engineServer.getRestRoutes()) {
			// Determine verb fallback: GET → reader, mutating methods → writer.
			let fallback: IRouteAuthorization | undefined;
			if (route.method === HttpMethod.GET) {
				fallback = DEFAULT_AUTHORIZATION_READER;
			} else if (
				route.method === HttpMethod.PUT ||
				route.method === HttpMethod.POST ||
				route.method === HttpMethod.PATCH ||
				route.method === HttpMethod.DELETE
			) {
				fallback = DEFAULT_AUTHORIZATION_WRITER;
			}
			seedRoute(route, fallback, policies, roleInheritances, policyKeys, inheritanceKeys, roles);
		}

		for (const route of engineServer.getSocketRoutes()) {
			// Socket routes have no HTTP method, so fall back to reader for all authenticated routes.
			seedRoute(
				route,
				DEFAULT_AUTHORIZATION_READER,
				policies,
				roleInheritances,
				policyKeys,
				inheritanceKeys,
				roles
			);
		}

		for (const role of roles) {
			roleInheritances.push({ role: DEFAULT_ESCALATED_PRIVILEGE_ROLE, inheritsFrom: role });
			if (role !== DEFAULT_USER_ROLE) {
				roleInheritances.push({ role, inheritsFrom: DEFAULT_USER_ROLE });
			}
		}
	}

	const model: IAuthorizationModel = { policies, roleInheritances };

	await ContextIdStore.run(nodeContextIds, async () => {
		await platformComponent.execute(async () => {
			await authorizationComponent.build(modelId, model);
		});
	});

	platformComponent.registerTenantEventCallback(
		"seedAuthorizationDefaults",
		async (tenantId, eventType) => {
			if (eventType === "created") {
				await ContextIdStore.run(
					{ ...nodeContextIds, [ContextIdKeys.Tenant]: tenantId },
					async () => {
						await authorizationComponent.build(modelId, model);
					}
				);
			}
		}
	);
}

/**
 * Merges a single route's authorization declaration into the shared accumulator sets.
 * @param route The route to seed authorization for.
 * @param fallbackAuthorization Authorization to apply when the route declares none.
 * @param policies The policy accumulator.
 * @param roleInheritances The role inheritance accumulator.
 * @param policyKeys Deduplication set for policies.
 * @param inheritanceKeys Deduplication set for role inheritances.
 * @param roles Roles collected for escalation processing.
 */
function seedRoute(
	route: IBaseRoute,
	fallbackAuthorization: IRouteAuthorization | undefined,
	policies: IAuthorizationPolicy[],
	roleInheritances: IAuthorizationInheritance[],
	policyKeys: Set<string>,
	inheritanceKeys: Set<string>,
	roles: Set<string>
): void {
	const requiresAuthorization = route.requiresAuthorization !== false && route.skipAuth !== true;
	let authorization: IRouteAuthorization | undefined = route.defaultAuthorization;

	if (!Is.objectValue<IRouteAuthorization>(authorization) && requiresAuthorization) {
		authorization = fallbackAuthorization;
	}

	if (Is.objectValue<IRouteAuthorization>(authorization)) {
		const policyKey = `${authorization.permission}|${route.operationId}`;
		if (!policyKeys.has(policyKey)) {
			policyKeys.add(policyKey);
			policies.push({
				subject: authorization.permission,
				object: route.operationId,
				action: "execute"
			});
		}
		if (Is.stringValue(authorization.role)) {
			const inheritKey = `${authorization.role}|${authorization.permission}`;
			if (!inheritanceKeys.has(inheritKey)) {
				inheritanceKeys.add(inheritKey);
				roleInheritances.push({
					role: authorization.role,
					inheritsFrom: authorization.permission
				});
			}
			roles.add(authorization.role);
		}
		if (Is.arrayValue(authorization.inherits)) {
			for (const inheritsFrom of authorization.inherits) {
				const inheritKey = `${authorization.permission}|${inheritsFrom}`;
				if (!inheritanceKeys.has(inheritKey)) {
					inheritanceKeys.add(inheritKey);
					roleInheritances.push({ role: authorization.permission, inheritsFrom });
				}
			}
		}
	}
}
