// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IPlatformComponent, IRestRoute, IRouteAuthorization } from "@twin.org/api-models";
import type {
	IAuthorizationComponent,
	IAuthorizationInheritance,
	IAuthorizationModel,
	IAuthorizationPolicy
} from "@twin.org/authorization-models";
import { ContextIdStore } from "@twin.org/context";
import { ComponentFactory, Is } from "@twin.org/core";
import type { IEngineCore } from "@twin.org/engine-models";
import { envObject, envString } from "./envHelpers.js";
import { AUTHORIZATION_MODEL_ID, DEFAULT_ESCALATED_PRIVILEGE_ROLE } from "../../defaults.js";
import type { IEngineEnvironmentVariables } from "../../models/IEngineEnvironmentVariables.js";

/**
 * Seed default authorization policies and role inheritances after the engine has started.
 * Uses the platform component to execute across all tenants in multi-tenant mode.
 * @param engineCore The running engine core.
 * @param envVars The environment variables.
 * @param routes The REST routes to derive default policies from.
 */
export async function seedAuthorizationDefaults(
	engineCore: IEngineCore,
	envVars: IEngineEnvironmentVariables,
	routes: IRestRoute[]
): Promise<void> {
	const nodeContextIds = engineCore.getContextIds() ?? {};
	if (!Is.stringValue(nodeContextIds.node)) {
		return;
	}

	const authComponentType = engineCore.getRegisteredInstanceTypeOptional("authorizationComponent");
	const platformComponentType = engineCore.getRegisteredInstanceTypeOptional("platformComponent");

	if (!Is.stringValue(authComponentType) || !Is.stringValue(platformComponentType)) {
		return;
	}

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
		}
	}

	if (!Is.objectValue(customModel) || rulesMode === "merge") {
		const policyKeys = new Set<string>();
		const inheritanceKeys = new Set<string>();
		const roles = new Set<string>();

		for (const route of routes) {
			const auth = route.defaultAuthorization;
			if (Is.objectValue<IRouteAuthorization>(auth)) {
				const policyKey = `${auth.permission}|${route.operationId}`;
				if (!policyKeys.has(policyKey)) {
					policyKeys.add(policyKey);
					policies.push({
						subject: auth.permission,
						object: route.operationId,
						action: "execute"
					});
				}
				if (Is.stringValue(auth.role)) {
					const inheritKey = `${auth.role}|${auth.permission}`;
					if (!inheritanceKeys.has(inheritKey)) {
						inheritanceKeys.add(inheritKey);
						roleInheritances.push({ role: auth.role, inheritsFrom: auth.permission });
					}
					roles.add(auth.role);
				}
				if (Is.arrayValue(auth.inherits)) {
					for (const inheritsFrom of auth.inherits) {
						const inheritKey = `${auth.permission}|${inheritsFrom}`;
						if (!inheritanceKeys.has(inheritKey)) {
							inheritanceKeys.add(inheritKey);
							roleInheritances.push({ role: auth.permission, inheritsFrom });
						}
					}
				}
			}
		}

		for (const role of roles) {
			roleInheritances.push({ role: DEFAULT_ESCALATED_PRIVILEGE_ROLE, inheritsFrom: role });
		}
	}

	const model: IAuthorizationModel = { policies, roleInheritances };

	await ContextIdStore.run(nodeContextIds, async () => {
		await platformComponent.execute(async () => {
			await authorizationComponent.build(modelId, model);
		});
	});
}
