// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { CLIDisplay } from "@twin.org/cli-core";
import { GeneralError, Guards, I18n, Is } from "@twin.org/core";
import type { IEngineCore } from "@twin.org/engine-models";
import { IdentityResolverConnectorFactory } from "@twin.org/identity-models";
import type { IDidDocument } from "@twin.org/standards-w3c-did";
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
 * @returns The resolved DID document.
 */
export async function identityResolve(
	engineCore: IEngineCore,
	envVars: IEnvironmentVariables,
	params: {
		identity?: string;
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

	if (Is.arrayValue(identityDocument.verificationMethod)) {
		CLIDisplay.value(
			I18n.formatMessage("node.cli.commands.identity-resolve.labels.verificationMethods"),
			identityDocument.verificationMethod.length.toString(),
			1
		);
		for (const method of identityDocument.verificationMethod) {
			if (Is.stringValue(method)) {
				CLIDisplay.value(method, "", 2);
			} else {
				const m = method;
				CLIDisplay.value(Is.stringValue(m.id) ? m.id : "", Is.stringValue(m.type) ? m.type : "", 2);
			}
		}
	}

	CLIDisplay.break();

	CLIDisplay.done();

	return identityDocument;
}
