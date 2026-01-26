// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { ITenantAdminComponent } from "@twin.org/api-models";
import { CLIDisplay } from "@twin.org/cli-core";
import {
	ComponentFactory,
	GeneralError,
	Guards,
	I18n,
	Is,
	NotFoundError,
	Url
} from "@twin.org/core";
import type { IEngineCore } from "@twin.org/engine-models";
import type { ICliCommandDefinition } from "../models/ICliCommandDefinition.js";
import type { INodeEnvironmentVariables } from "../models/INodeEnvironmentVariables.js";

const COMMAND_NAME = "tenant-update";

/**
 * Get the command definition parameters.
 * @param commandDefinitions The registered command definitions.
 */
export function getCommandDefinitionTenantUpdate(commandDefinitions: {
	[id: string]: ICliCommandDefinition;
}): void {
	commandDefinitions[COMMAND_NAME] = {
		command: COMMAND_NAME,
		description: I18n.formatMessage("node.cli.commands.tenant-update.description"),
		example: I18n.formatMessage("node.cli.commands.tenant-update.example"),
		requiresTenantId: false,
		params: [
			{
				key: "tenant-id",
				type: "string",
				extendedType: "hex(32)",
				description: I18n.formatMessage(
					"node.cli.commands.tenant-update.params.tenant-id.description"
				),
				required: true
			},
			{
				key: "api-key",
				type: "string",
				extendedType: "hex(32)",
				description: I18n.formatMessage(
					"node.cli.commands.tenant-update.params.api-key.description"
				),
				required: false
			},
			{
				key: "label",
				type: "string",
				description: I18n.formatMessage("node.cli.commands.tenant-update.params.label.description"),
				required: false
			},
			{
				key: "public-origin",
				type: "string",
				extendedType: "url",
				description: I18n.formatMessage(
					"node.cli.commands.tenant-update.params.public-origin.description"
				),
				required: false
			},
			{
				key: "load-env",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.tenant-update.params.load-env.description"
				),
				required: false
			}
		],
		action: async (engineCore, envVars, params) => tenantUpdate(engineCore, envVars, params)
	};
}

/**
 * Command for updating a tenant.
 * @param engineCore The engine core.
 * @param envVars The environment variables for the node.
 * @param params The parameters for the command.
 * @param params.apiKey The api key to update.
 * @param params.tenantId The tenant ID to update the api key to.
 * @param params.label The label for the api key.
 * @param params.publicOrigin The public URL origin for the tenant.
 */
export async function tenantUpdate(
	engineCore: IEngineCore,
	envVars: INodeEnvironmentVariables,
	params: {
		apiKey?: string;
		tenantId?: string;
		label?: string;
		publicOrigin?: string;
	}
): Promise<void> {
	Guards.stringHexLength("tenantUpdate", "tenant-id", params.tenantId, 32);

	if (Is.stringValue(params.apiKey)) {
		Guards.stringHexLength("tenantUpdate", "api-key", params.apiKey, 32);
	}

	if (Is.stringValue(params.publicOrigin)) {
		Url.guard("tenantUpdate", "public-origin", params.publicOrigin);
	}

	const defaultTenantAdminComponentType =
		engineCore.getRegisteredInstanceType("tenantAdminComponent");

	if (!Is.stringValue(defaultTenantAdminComponentType)) {
		throw new GeneralError("tenantUpdate", "tenantAdminComponentNotRegistered");
	}

	const tenantAdminComponent = ComponentFactory.get<ITenantAdminComponent>(
		defaultTenantAdminComponentType
	);

	const tenant = await tenantAdminComponent.get(params.tenantId);

	if (Is.empty(tenant)) {
		throw new NotFoundError("tenantUpdate", "tenantNotFound", params.tenantId);
	}

	CLIDisplay.task(I18n.formatMessage("node.cli.commands.tenant-update.labels.updating"));
	CLIDisplay.spinnerStart();

	const apiKey = params.apiKey;
	const tenantId = params.tenantId;
	const label = params.label ?? "";
	const publicOrigin = params.publicOrigin ?? "";
	await tenantAdminComponent.set({
		id: tenantId,
		apiKey: Is.stringValue(apiKey) ? apiKey : tenant.apiKey,
		dateCreated: tenant.dateCreated,
		label: Is.stringValue(label) ? label : tenant.label,
		publicOrigin: Is.stringValue(publicOrigin) ? publicOrigin : tenant.publicOrigin,
		isNodeTenant: tenant.isNodeTenant
	});
	CLIDisplay.spinnerStop();
	CLIDisplay.task(I18n.formatMessage("node.cli.commands.tenant-update.labels.updated"));

	CLIDisplay.break();

	CLIDisplay.done();
}
