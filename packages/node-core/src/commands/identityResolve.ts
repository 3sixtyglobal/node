// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { CLIDisplay, CLIUtils } from "@3sixty/cli-core";
import { GeneralError, Guards, I18n, Is } from "@3sixty/core";
import type { IEngineCore } from "@3sixty/engine-models";
import { IdentityResolverConnectorFactory } from "@3sixty/identity-models";
import type { IDidDocument } from "@3sixty/standards-w3c-did";
import type { ICliCommandDefinition } from "../models/ICliCommandDefinition.js";
import type { IEnvironmentVariables } from "../models/IEnvironmentVariables.js";

const COMMAND_NAME = "identity-resolve";

/**
 * Get the command definition parameters.
 * @param commandDefinitions The registered command definitions.
 */
export function getCommandDefinitionIdentityResolve(commandDefinitions: {
	[id: string]: ICliCommandDefinition;
}): void {
	commandDefinitions[COMMAND_NAME] = {
		command: COMMAND_NAME,
		description: I18n.formatMessage("node.cli.commands.identity-resolve.description"),
		example: I18n.formatMessage("node.cli.commands.identity-resolve.example"),
		requiresNodeIdentity: false,
		requiresOrgIdentity: false,
		params: [
			{
				key: "env-prefix",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.identity-resolve.params.env-prefix.description"
				),
				required: false
			},
			{
				key: "identity",
				type: "string",
				extendedType: "did",
				description: I18n.formatMessage(
					"node.cli.commands.identity-resolve.params.identity.description"
				),
				required: true
			},
			{
				key: "load-env",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.identity-resolve.params.load-env.description"
				),
				required: false
			},
			{
				key: "output-json",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.identity-resolve.params.output-json.description"
				),
				required: false
			}
		],
		action: async (engineCore, envVars, params) => identityResolve(engineCore, envVars, params)
	};
}

/**
 * Command for resolving an identity DID to its full document.
 * @param engineCore The engine core.
 * @param envVars The environment variables for the node.
 * @param params The parameters for the command.
 * @param params.identity The DID to resolve.
 * @param params.outputJson The output .json file to store the resolved DID document.
 * @returns The resolved DID document.
 */
export async function identityResolve(
	engineCore: IEngineCore,
	envVars: IEnvironmentVariables,
	params: {
		identity?: string;
		outputJson?: string;
	}
): Promise<IDidDocument> {
	Guards.stringValue("identityResolve", "identity", params.identity);

	CLIDisplay.task(I18n.formatMessage("node.cli.commands.identity-resolve.labels.resolving"));

	const defaultIdentityResolverConnectorType = engineCore.getRegisteredInstanceType(
		"identityResolverConnector"
	);

	const identityResolverConnector = IdentityResolverConnectorFactory.get(
		defaultIdentityResolverConnectorType
	);

	let identityDocument: IDidDocument | undefined;
	try {
		identityDocument = await identityResolverConnector.resolveDocument(params.identity);
	} catch {}

	if (!Is.objectValue(identityDocument)) {
		throw new GeneralError("identityResolve", "identityNotFound", {
			identity: params.identity
		});
	}

	CLIDisplay.break();
	CLIDisplay.value(
		I18n.formatMessage("node.cli.commands.identity-resolve.labels.did"),
		identityDocument.id
	);
	CLIDisplay.break();
	CLIDisplay.json(identityDocument);
	CLIDisplay.break();

	if (Is.stringValue(params.outputJson)) {
		await CLIUtils.writeJsonFile(params.outputJson, identityDocument, false);
	}

	CLIDisplay.done();

	return identityDocument;
}
