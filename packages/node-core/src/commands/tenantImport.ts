// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { ITenantAdminComponent } from "@twin.org/api-models";
import { CLIDisplay } from "@twin.org/cli-core";
import { ComponentFactory, GeneralError, Guards, I18n, Is, Url } from "@twin.org/core";
import type { IEngineCore } from "@twin.org/engine-models";
import type { ICliCommandDefinition } from "../models/ICliCommandDefinition.js";
import type { INodeEnvironmentVariables } from "../models/INodeEnvironmentVariables.js";

const COMMAND_NAME = "tenant-import";

/**
 * Get the command definition parameters.
 * @param commandDefinitions The registered command definitions.
 */
export function getCommandDefinitionTenantImport(commandDefinitions: {
	[id: string]: ICliCommandDefinition;
}): void {
	commandDefinitions[COMMAND_NAME] = {
		command: COMMAND_NAME,
		description: I18n.formatMessage("node.cli.commands.tenant-import.description"),
		example: I18n.formatMessage("node.cli.commands.tenant-import.example"),
		requiresTenantId: false,
		params: [
			{
				key: "tenant-id",
				type: "string",
				extendedType: "hex(32)",
				description: I18n.formatMessage(
					"node.cli.commands.tenant-import.params.tenant-id.description"
				),
				required: true
			},
			{
				key: "api-key",
				type: "string",
				extendedType: "hex(32)",
				description: I18n.formatMessage(
					"node.cli.commands.tenant-import.params.api-key.description"
				),
				required: true
			},
			{
				key: "label",
				type: "string",
				description: I18n.formatMessage("node.cli.commands.tenant-import.params.label.description"),
				required: false
			},
			{
				key: "public-origin",
				type: "string",
				extendedType: "url",
				description: I18n.formatMessage(
					"node.cli.commands.tenant-import.params.public-origin.description"
				),
				required: false
			},
			{
				key: "load-env",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.tenant-import.params.load-env.description"
				),
				required: false
			}
		],
		action: async (engineCore, envVars, params) => tenantImport(engineCore, envVars, params)
	};
}

/**
 * Command for importing a tenant.
 * @param engineCore The engine core.
 * @param envVars The environment variables for the node.
 * @param params The parameters for the command.
 * @param params.apiKey The api key to import.
 * @param params.tenantId The tenant ID to import the api key to.
 * @param params.label The label for the api key.
 * @param params.publicOrigin The public URL origin for the tenant.
 */
export async function tenantImport(
	engineCore: IEngineCore,
	envVars: INodeEnvironmentVariables,
	params: {
		apiKey?: string;
		tenantId?: string;
		label?: string;
		publicOrigin?: string;
	}
): Promise<void> {
	Guards.stringHexLength("tenantImport", "tenant-id", params.tenantId, 32);
	Guards.stringHexLength("tenantImport", "api-key", params.apiKey, 32);

	if (Is.stringValue(params.publicOrigin)) {
		Url.guard("tenantImport", "public-origin", params.publicOrigin);
	}

	const tenantAdminServiceComponentType =
		engineCore.getRegisteredInstanceTypeOptional("tenantAdminComponent");

	if (!Is.stringValue(tenantAdminServiceComponentType)) {
		throw new GeneralError("tenantImport", "tenantAdminComponentNotRegistered");
	}

	const tenantAdminService = ComponentFactory.get<ITenantAdminComponent>(
		tenantAdminServiceComponentType
	);

	CLIDisplay.task(I18n.formatMessage("node.cli.commands.tenant-import.labels.importing"));
	CLIDisplay.spinnerStart();

	const apiKey = params.apiKey;
	const tenantId = params.tenantId;
	const label = params.label ?? "";
	const publicOrigin = params.publicOrigin ?? "";
	await tenantAdminService.set({
		id: tenantId,
		apiKey,
		dateCreated: new Date(Date.now()).toISOString(),
		label,
		publicOrigin,
		isNodeTenant: false
	});
	CLIDisplay.spinnerStop();
	CLIDisplay.task(I18n.formatMessage("node.cli.commands.tenant-import.labels.imported"));

	CLIDisplay.break();

	CLIDisplay.done();
}
