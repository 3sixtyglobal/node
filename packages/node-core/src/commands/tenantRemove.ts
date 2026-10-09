// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { ITenantAdminComponent } from "@3sixty/api-models";
import { CLIDisplay } from "@3sixty/cli-core";
import { ComponentFactory, GeneralError, Guards, I18n, Is } from "@3sixty/core";
import type { IEngineCore } from "@3sixty/engine-models";
import type { ICliCommandDefinition } from "../models/ICliCommandDefinition.js";
import type { IEnvironmentVariables } from "../models/IEnvironmentVariables.js";

const COMMAND_NAME = "tenant-remove";

/**
 * Get the command definition parameters.
 * @param commandDefinitions The registered command definitions.
 */
export function getCommandDefinitionTenantRemove(commandDefinitions: {
	[id: string]: ICliCommandDefinition;
}): void {
	commandDefinitions[COMMAND_NAME] = {
		command: COMMAND_NAME,
		description: I18n.formatMessage("node.cli.commands.tenant-remove.description"),
		example: I18n.formatMessage("node.cli.commands.tenant-remove.example"),
		requiresNodeIdentity: false,
		requiresOrgIdentity: false,
		params: [
			{
				key: "env-prefix",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.tenant-remove.params.env-prefix.description"
				),
				required: false
			},
			{
				key: "tenant-id",
				type: "string",
				extendedType: "hex(32)",
				description: I18n.formatMessage(
					"node.cli.commands.tenant-remove.params.tenant-id.description"
				),
				required: true
			},
			{
				key: "load-env",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.tenant-remove.params.load-env.description"
				),
				required: false
			}
		],
		action: async (engineCore, envVars, params) => tenantRemove(engineCore, envVars, params)
	};
}

/**
 * Command for removing a tenant.
 * @param engineCore The engine core.
 * @param envVars The environment variables for the node.
 * @param params The parameters for the command.
 * @param params.tenantId The ID of the tenant to remove.
 * @returns A promise that resolves when the tenant has been removed.
 */
export async function tenantRemove(
	engineCore: IEngineCore,
	envVars: IEnvironmentVariables,
	params: {
		tenantId?: string;
	}
): Promise<void> {
	Guards.stringHexLength("tenantRemove", "tenant-id", params.tenantId, 32);

	const type = engineCore.getRegisteredInstanceTypeOptional("tenantAdminComponent");

	if (!Is.stringValue(type)) {
		throw new GeneralError("tenantRemove", "tenantAdminComponentNotRegistered");
	}

	const tenantAdminComponent = ComponentFactory.get<ITenantAdminComponent>(type);

	CLIDisplay.task(I18n.formatMessage("node.cli.commands.tenant-remove.labels.removing"));
	CLIDisplay.spinnerStart();

	// The remove is silent for an unknown tenant, so read it first to report a missing tenant
	await tenantAdminComponent.get(params.tenantId);
	await tenantAdminComponent.remove(params.tenantId);

	CLIDisplay.spinnerStop();
	CLIDisplay.task(I18n.formatMessage("node.cli.commands.tenant-remove.labels.removed"));

	CLIDisplay.break();
	CLIDisplay.done();
}
