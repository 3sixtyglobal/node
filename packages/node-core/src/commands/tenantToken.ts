// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { ITenantAdminComponent, IUrlTransformerComponent } from "@twin.org/api-models";
import { CLIDisplay, CLIUtils } from "@twin.org/cli-core";
import { ComponentFactory, GeneralError, Guards, I18n, Is } from "@twin.org/core";
import type { IEngineCore } from "@twin.org/engine-models";
import type { ICliCommandDefinition } from "../models/ICliCommandDefinition.js";
import type { INodeEnvironmentVariables } from "../models/INodeEnvironmentVariables.js";

const COMMAND_NAME = "tenant-token";

/**
 * Get the command definition parameters.
 * @param commandDefinitions The registered command definitions.
 */
export function getCommandDefinitionTenantToken(commandDefinitions: {
	[id: string]: ICliCommandDefinition;
}): void {
	commandDefinitions[COMMAND_NAME] = {
		command: COMMAND_NAME,
		description: I18n.formatMessage("node.cli.commands.tenant-token.description"),
		example: I18n.formatMessage("node.cli.commands.tenant-token.example"),
		requiresTenantId: false,
		params: [
			{
				key: "tenant-id",
				type: "string",
				extendedType: "hex(32)",
				description: I18n.formatMessage(
					"node.cli.commands.tenant-token.params.tenant-id.description"
				),
				required: false
			},
			{
				key: "api-key",
				type: "string",
				extendedType: "hex(32)",
				description: I18n.formatMessage(
					"node.cli.commands.tenant-token.params.api-key.description"
				),
				required: false
			},
			{
				key: "load-env",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.tenant-token.params.load-env.description"
				),
				required: false
			},
			{
				key: "output-json",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.tenant-token.params.output-json.description"
				),
				required: false
			}
		],
		action: async (engineCore, envVars, params) => tenantToken(engineCore, envVars, params)
	};
}

/**
 * Command for generating the x-enc-tenant-id token value for a tenant.
 * @param engineCore The engine core.
 * @param envVars The environment variables for the node.
 * @param params The parameters for the command.
 * @param params.tenantId The tenant ID to generate the token for.
 * @param params.apiKey The API key to look up the tenant ID from.
 * @param params.outputJson The output .json file to store the command output.
 * @returns The tenant ID and generated encrypted token.
 */
export async function tenantToken(
	engineCore: IEngineCore,
	envVars: INodeEnvironmentVariables,
	params: {
		tenantId?: string;
		apiKey?: string;
		outputJson?: string;
	}
): Promise<{ tenantId: string; token: string }> {
	if (!Is.stringValue(params.tenantId) && !Is.stringValue(params.apiKey)) {
		throw new GeneralError("tenantToken", "tenantIdOrApiKeyRequired");
	}

	if (Is.stringValue(params.tenantId)) {
		Guards.stringHexLength("tenantToken", "tenant-id", params.tenantId, 32);
	}

	if (Is.stringValue(params.apiKey)) {
		Guards.stringHexLength("tenantToken", "api-key", params.apiKey, 32);
	}

	const urlTransformerComponentType =
		engineCore.getRegisteredInstanceTypeOptional("urlTransformerComponent");

	if (!Is.stringValue(urlTransformerComponentType)) {
		throw new GeneralError("tenantToken", "urlTransformerComponentNotRegistered");
	}

	const urlTransformer = ComponentFactory.get<IUrlTransformerComponent>(
		urlTransformerComponentType
	);

	// CLI commands skip component starts (engineCore.start(true)), so the URL transformer
	// service's _nodeId is never initialized. Starting it here within the ContextIdStore
	// context (set by executeCommand) lets it pick up the nodeId correctly.
	await urlTransformer.start?.();

	let tenantId = params.tenantId;

	if (!Is.stringValue(tenantId)) {
		const tenantAdminServiceComponentType =
			engineCore.getRegisteredInstanceTypeOptional("tenantAdminComponent");

		if (!Is.stringValue(tenantAdminServiceComponentType)) {
			throw new GeneralError("tenantToken", "tenantAdminComponentNotRegistered");
		}

		const tenantAdminService = ComponentFactory.get<ITenantAdminComponent>(
			tenantAdminServiceComponentType
		);

		CLIDisplay.task(I18n.formatMessage("node.cli.commands.tenant-token.labels.lookingUp"));

		const tenant = await tenantAdminService.getByApiKey(params.apiKey as string);
		tenantId = tenant.id;
	}

	CLIDisplay.task(I18n.formatMessage("node.cli.commands.tenant-token.labels.generating"));

	const token = await urlTransformer.encryptParam(tenantId);

	CLIDisplay.break();
	CLIDisplay.value(I18n.formatMessage("node.cli.commands.tenant-token.labels.tenantId"), tenantId);
	CLIDisplay.value(I18n.formatMessage("node.cli.commands.tenant-token.labels.token"), token);
	CLIDisplay.break();

	const json = { tenantId, token };
	if (Is.stringValue(params.outputJson)) {
		await CLIUtils.writeJsonFile(params.outputJson, json, false);
	}

	CLIDisplay.done();

	return json;
}
