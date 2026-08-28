// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IPlatformComponent, IRouteAuthorization } from "@twin.org/api-models";
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
import { envObject, envString } from "./envHelpers.js";
import {
	AUTHORIZATION_MODEL_ID,
	DEFAULT_ESCALATED_PRIVILEGE_ROLE,
	DEFAULT_USER_ROLE
} from "../../defaults.js";
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
	const rulesMode = envVars.authorizationModelMode ?? "merge";

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

	if (!Is.objectValue(customModel) || rulesMode === "merge") {
		const policyKeys = new Set<string>();
		const inheritanceKeys = new Set<string>();
		const roles = new Set<string>();

		const routes = engineServer.getRestRoutes();
		for (const route of routes) {
			const requiresAuthorization =
				route.requiresAuthorization !== false && route.skipAuth !== true;
			let authorization: IRouteAuthorization | undefined = route.defaultAuthorization;

			// If there are no specific default permissions we provide
			// a fallback based on the HTTP method for the default "user" role.
			if (!Is.objectValue<IRouteAuthorization>(authorization) && requiresAuthorization) {
				if (route.method === HttpMethod.GET) {
					authorization = DEFAULT_AUTHORIZATION_READER;
				} else if (
					route.method === HttpMethod.PUT ||
					route.method === HttpMethod.POST ||
					route.method === HttpMethod.PATCH ||
					route.method === HttpMethod.DELETE
				) {
					authorization = DEFAULT_AUTHORIZATION_WRITER;
				}
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
