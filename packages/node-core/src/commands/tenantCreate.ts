// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { ITenantAdminComponent } from "@twin.org/api-models";
import { TenantIdHelper } from "@twin.org/api-tenant-processor";
import { CLIDisplay, CLIUtils } from "@twin.org/cli-core";
import { ComponentFactory, GeneralError, Guards, I18n, Is, Url } from "@twin.org/core";
import type { IEngineCore } from "@twin.org/engine-models";
import type { ICliCommandDefinition } from "../models/ICliCommandDefinition.js";
import type { INodeEnvironmentVariables } from "../models/INodeEnvironmentVariables.js";

const COMMAND_NAME = "tenant-create";

/**
 * Get the command definition parameters.
 * @param commandDefinitions The registered command definitions.
 */
export function getCommandDefinitionTenantCreate(commandDefinitions: {
	[id: string]: ICliCommandDefinition;
}): void {
	commandDefinitions[COMMAND_NAME] = {
		command: COMMAND_NAME,
		description: I18n.formatMessage("node.cli.commands.tenant-create.description"),
		example: I18n.formatMessage("node.cli.commands.tenant-create.example"),
		params: [
			{
				key: "env-prefix",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.tenant-create.params.env-prefix.description"
				),
				required: false
			},
			{
				key: "tenant-id",
				type: "string",
				extendedType: "hex(32)",
				description: I18n.formatMessage(
					"node.cli.commands.tenant-create.params.tenant-id.description"
				),
				required: false
			},
			{
				key: "api-key",
				type: "string",
				extendedType: "hex(32)",
				description: I18n.formatMessage(
					"node.cli.commands.tenant-create.params.api-key.description"
				),
				required: false
			},
			{
				key: "public-origin",
				type: "string",
				extendedType: "url",
				description: I18n.formatMessage(
					"node.cli.commands.tenant-create.params.public-origin.description"
				),
				required: false
			},
			{
				key: "label",
				type: "string",
				description: I18n.formatMessage("node.cli.commands.tenant-create.params.label.description"),
				required: false
			},
			{
				key: "load-env",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.tenant-create.params.load-env.description"
				),
				required: false
			},
			{
				key: "output-json",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.tenant-create.params.output-json.description"
				),
				required: false
			},
			{
				key: "output-env",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.tenant-create.params.output-env.description"
				),
				required: false
			},
			{
				key: "output-env-prefix",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.tenant-create.params.output-env-prefix.description"
				),
				required: false
			}
		],
		action: async (engineCore, envVars, params) => tenantCreate(engineCore, envVars, params)
	};
}

/**
 * Command for creating a tenant.
 * @param engineCore The engine core.
 * @param envVars The environment variables for the node.
 * @param params The parameters for the command.
 * @param params.apiKey The api key to add.
 * @param params.tenantId The tenant ID to add the api key to.
 * @param params.label The label for the api key.
 * @param params.publicOrigin The public URL origin for the tenant.
 * @param params.outputJson The output .json file to store the command output.
 * @param params.outputEnv The output .env file to store the command output.
 * @param params.outputEnvPrefix The prefix to use for variables in the output .env file.
 * @returns The created tenant details.
 */
export async function tenantCreate(
	engineCore: IEngineCore,
	envVars: INodeEnvironmentVariables,
	params: {
		apiKey?: string;
		tenantId?: string;
		label?: string;
		publicOrigin?: string;
		outputJson?: string;
		outputEnv?: string;
		outputEnvPrefix?: string;
	}
): Promise<{ apiKey: string; tenantId: string; label: string; publicOrigin: string }> {
	if (Is.stringValue(params.tenantId)) {
		Guards.stringHexLength("tenantCreate", "tenant-id", params.tenantId, 32);
	}

	if (Is.stringValue(params.apiKey)) {
		Guards.stringHexLength("tenantCreate", "api-key", params.apiKey, 32);
	}

	if (Is.stringValue(params.publicOrigin)) {
		Url.guard("tenantCreate", "public-origin", params.publicOrigin);
	}

	const tenantAdminServiceComponentType =
		engineCore.getRegisteredInstanceTypeOptional("tenantAdminComponent");

	if (!Is.stringValue(tenantAdminServiceComponentType)) {
		throw new GeneralError("tenantCreate", "tenantAdminComponentNotRegistered");
	}

	const tenantAdminService = ComponentFactory.get<ITenantAdminComponent>(
		tenantAdminServiceComponentType
	);

	CLIDisplay.task(I18n.formatMessage("node.cli.commands.tenant-create.labels.creating"));

	const apiKey = params.apiKey ?? TenantIdHelper.generateApiKey();
	const tenantId = params.tenantId ?? TenantIdHelper.generateTenantId();
	const label = params.label ?? "";
	const publicOrigin = params.publicOrigin ?? "";
	await tenantAdminService.create({
		id: tenantId,
		apiKey,
		label,
		publicOrigin
	});

	CLIDisplay.break();
	CLIDisplay.value(I18n.formatMessage("node.cli.commands.tenant-create.labels.tenantId"), tenantId);
	CLIDisplay.value(I18n.formatMessage("node.cli.commands.tenant-create.labels.apiKey"), apiKey);
	CLIDisplay.value(I18n.formatMessage("node.cli.commands.tenant-create.labels.label"), label);
	CLIDisplay.value(
		I18n.formatMessage("node.cli.commands.tenant-create.labels.publicOrigin"),
		publicOrigin
	);
	CLIDisplay.break();

	const json = { apiKey, tenantId, label, publicOrigin };
	if (Is.stringValue(params.outputJson)) {
		await CLIUtils.writeJsonFile(params.outputJson, json, false);
	}

	if (Is.stringValue(params.outputEnv)) {
		await CLIUtils.writeEnvFile(
			params.outputEnv,
			[
				`${params.outputEnvPrefix}API_KEY="${apiKey}"`,
				`${params.outputEnvPrefix}TENANT_ID="${tenantId}"`,
				`${params.outputEnvPrefix}LABEL="${label}"`,
				`${params.outputEnvPrefix}PUBLIC_ORIGIN="${publicOrigin}"`
			],
			false
		);
	}

	CLIDisplay.done();

	return json;
}
