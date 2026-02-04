// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { ITenantAdminComponent } from "@twin.org/api-models";
import { CLIDisplay } from "@twin.org/cli-core";
import { ComponentFactory, GeneralError, Guards, I18n, Is } from "@twin.org/core";
import type { IEngineCore } from "@twin.org/engine-models";
import type { ICliCommandDefinition } from "../models/ICliCommandDefinition.js";
import type { INodeEngineConfig } from "../models/INodeEngineConfig.js";
import type { INodeEngineState } from "../models/INodeEngineState.js";
import type { INodeEnvironmentVariables } from "../models/INodeEnvironmentVariables.js";

const COMMAND_NAME = "node-set-tenant";

/**
 * Get the command definition parameters.
 * @param commandDefinitions The registered command definitions.
 */
export function getCommandDefinitionNodeSetTenant(commandDefinitions: {
	[id: string]: ICliCommandDefinition;
}): void {
	commandDefinitions[COMMAND_NAME] = {
		command: COMMAND_NAME,
		description: I18n.formatMessage("node.cli.commands.node-set-tenant.description"),
		example: I18n.formatMessage("node.cli.commands.node-set-tenant.example"),
		requiresTenantId: false,
		params: [
			{
				key: "env-prefix",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.node-set-tenant.params.env-prefix.description"
				),
				required: false
			},
			{
				key: "tenant-id",
				type: "string",
				extendedType: "hex(32)",
				description: I18n.formatMessage(
					"node.cli.commands.node-set-tenant.params.tenant-id.description"
				),
				required: true
			},
			{
				key: "load-env",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.node-set-tenant.params.load-env.description"
				),
				required: false
			}
		],
		action: async (engineCore, envVars, params) => nodeSetTenant(engineCore, envVars, params)
	};
}

/**
 * Command for setting a node tenant.
 * @param engineCore The engine core.
 * @param envVars The environment variables for the node.
 * @param params The parameters for the command.
 * @param params.tenantId The tenant id to set for the node.
 */
export async function nodeSetTenant(
	engineCore: IEngineCore<INodeEngineConfig, INodeEngineState>,
	envVars: INodeEnvironmentVariables,
	params: {
		tenantId?: string;
	}
): Promise<void> {
	Guards.stringHexLength("nodeSetTenant", "tenant-id", params.tenantId, 32);

	const state = engineCore.getState();

	if (state.nodeTenantId !== params.tenantId) {
		const defaultTenantAdminComponentType =
			engineCore.getRegisteredInstanceType("tenantAdminComponent");

		if (!Is.stringValue(defaultTenantAdminComponentType)) {
			throw new GeneralError("nodeSetTenant", "tenantAdminComponentNotRegistered");
		}

		const tenantAdminComponent = ComponentFactory.get<ITenantAdminComponent>(
			defaultTenantAdminComponentType
		);

		const tenant = await tenantAdminComponent.get(params.tenantId);

		const currentNodeTenants = await tenantAdminComponent.query({ isNodeTenant: true });
		for (const currentNodeTenant of currentNodeTenants.tenants) {
			currentNodeTenant.isNodeTenant = false;
			await tenantAdminComponent.update(currentNodeTenant);
		}

		tenant.isNodeTenant = true;
		await tenantAdminComponent.update(tenant);
		state.nodeTenantId = params.tenantId;
		engineCore.setStateDirty();

		CLIDisplay.task(I18n.formatMessage("node.cli.commands.node-set-tenant.labels.stored"));
	}

	CLIDisplay.done();
}
