// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { ITenantAdminComponent, ITenant } from "@3sixty/api-models";
import { CLIDisplay } from "@3sixty/cli-core";
import { ComponentFactory, GeneralError, Guards, I18n, Is } from "@3sixty/core";
import type { IEngineCore } from "@3sixty/engine-models";
import type { ICliCommandDefinition } from "../models/ICliCommandDefinition.js";
import type { IEnvironmentVariables } from "../models/IEnvironmentVariables.js";

const COMMAND_NAME = "tenant-get";

/**
 * Get the command definition parameters.
 * @param commandDefinitions The registered command definitions.
 */
export function getCommandDefinitionTenantGet(commandDefinitions: {
	[id: string]: ICliCommandDefinition;
}): void {
	commandDefinitions[COMMAND_NAME] = {
		command: COMMAND_NAME,
		description: I18n.formatMessage("node.cli.commands.tenant-get.description"),
		example: I18n.formatMessage("node.cli.commands.tenant-get.example"),
		requiresNodeIdentity: false,
		requiresOrgIdentity: false,
		params: [
			{
				key: "env-prefix",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.tenant-get.params.env-prefix.description"
				),
				required: false
			},
			{
				key: "tenant-id",
				type: "string",
				extendedType: "hex(32)",
				description: I18n.formatMessage(
					"node.cli.commands.tenant-get.params.tenant-id.description"
				),
				required: true
			},
			{
				key: "load-env",
				type: "string",
				description: I18n.formatMessage("node.cli.commands.tenant-get.params.load-env.description"),
				required: false
			}
		],
		action: async (engineCore, envVars, params) => tenantGet(engineCore, envVars, params)
	};
}

/**
 * Command for retrieving a single tenant by ID.
 * @param engineCore The engine core.
 * @param envVars The environment variables for the node.
 * @param params The parameters for the command.
 * @param params.tenantId The ID of the tenant to retrieve.
 * @returns The tenant record.
 */
export async function tenantGet(
	engineCore: IEngineCore,
	envVars: IEnvironmentVariables,
	params: {
		tenantId?: string;
	}
): Promise<ITenant> {
	Guards.stringHexLength("tenantGet", "tenant-id", params.tenantId, 32);

	const type = engineCore.getRegisteredInstanceTypeOptional("tenantAdminComponent");

	if (!Is.stringValue(type)) {
		throw new GeneralError("tenantGet", "tenantAdminComponentNotRegistered");
	}

	const tenantAdminComponent = ComponentFactory.get<ITenantAdminComponent>(type);

	CLIDisplay.task(I18n.formatMessage("node.cli.commands.tenant-get.labels.retrieving"));

	const tenant = await tenantAdminComponent.get(params.tenantId);

	CLIDisplay.break();
	CLIDisplay.value(I18n.formatMessage("node.cli.commands.tenant-get.labels.tenantId"), tenant.id);
	CLIDisplay.value(
		I18n.formatMessage("node.cli.commands.tenant-get.labels.apiKey"),
		tenant.apiKey,
		1
	);
	CLIDisplay.value(
		I18n.formatMessage("node.cli.commands.tenant-get.labels.organizationId"),
		tenant.organizationId ?? "",
		1
	);
	CLIDisplay.value(
		I18n.formatMessage("node.cli.commands.tenant-get.labels.label"),
		tenant.label ?? "",
		1
	);
	CLIDisplay.value(
		I18n.formatMessage("node.cli.commands.tenant-get.labels.publicOrigin"),
		tenant.publicOrigin ?? "",
		1
	);
	CLIDisplay.value(
		I18n.formatMessage("node.cli.commands.tenant-get.labels.dateCreated"),
		tenant.dateCreated,
		1
	);
	CLIDisplay.value(
		I18n.formatMessage("node.cli.commands.tenant-get.labels.dateModified"),
		tenant.dateModified,
		1
	);
	CLIDisplay.break();

	CLIDisplay.done();

	return tenant;
}
