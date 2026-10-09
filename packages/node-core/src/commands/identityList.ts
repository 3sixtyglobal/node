// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { CLIDisplay } from "@3sixty/cli-core";
import { I18n, Is } from "@3sixty/core";
import type { IEngineCore } from "@3sixty/engine-models";
import {
	EntityStorageConnectorFactory,
	type IEntityStorageConnector
} from "@3sixty/entity-storage-models";
import type { IdentityDocument } from "@3sixty/identity-connector-entity-storage";
import { nameofKebabCase } from "@3sixty/nameof";
import type { ICliCommandDefinition } from "../models/ICliCommandDefinition.js";
import type { IEnvironmentVariables } from "../models/IEnvironmentVariables.js";

const COMMAND_NAME = "identity-list";

/**
 * Get the command definition parameters.
 * @param commandDefinitions The registered command definitions.
 */
export function getCommandDefinitionIdentityList(commandDefinitions: {
	[id: string]: ICliCommandDefinition;
}): void {
	commandDefinitions[COMMAND_NAME] = {
		command: COMMAND_NAME,
		description: I18n.formatMessage("node.cli.commands.identity-list.description"),
		example: I18n.formatMessage("node.cli.commands.identity-list.example"),
		requiresNodeIdentity: false,
		requiresOrgIdentity: false,
		params: [
			{
				key: "env-prefix",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.identity-list.params.env-prefix.description"
				),
				required: false
			},
			{
				key: "load-env",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.identity-list.params.load-env.description"
				),
				required: false
			}
		],
		action: async (engineCore, envVars) => identityList(engineCore, envVars)
	};
}

/**
 * Command for listing all identities held in custody by the node.
 * @param engineCore The engine core.
 * @param envVars The environment variables for the node.
 * @returns The list of identity DIDs.
 */
export async function identityList(
	engineCore: IEngineCore,
	envVars: IEnvironmentVariables
): Promise<string[]> {
	CLIDisplay.task(I18n.formatMessage("node.cli.commands.identity-list.labels.listing"));

	const identityStorage =
		EntityStorageConnectorFactory.get<IEntityStorageConnector<IdentityDocument>>(
			nameofKebabCase<IdentityDocument>()
		);

	const result: string[] = [];
	let cursor: string | undefined;

	do {
		const page = await identityStorage.query(undefined, undefined, ["id", "controller"], cursor);
		for (const doc of page.entities) {
			if (Is.stringValue(doc.id)) {
				result.push(doc.id);
				CLIDisplay.break();
				CLIDisplay.value(I18n.formatMessage("node.cli.commands.identity-list.labels.did"), doc.id);
				if (Is.stringValue(doc.controller)) {
					CLIDisplay.value(
						I18n.formatMessage("node.cli.commands.identity-list.labels.controller"),
						doc.controller,
						1
					);
				}
			}
		}
		cursor = page.cursor;
	} while (Is.stringValue(cursor));

	CLIDisplay.break();
	CLIDisplay.value(
		I18n.formatMessage("node.cli.commands.identity-list.labels.count"),
		result.length.toString()
	);

	CLIDisplay.done();

	return result;
}
