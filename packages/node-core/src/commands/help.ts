// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { CLIDisplay } from "@twin.org/cli-core";
import { I18n, Is } from "@twin.org/core";
import type { IEngineCore } from "@twin.org/engine-models";
import type { ICliCommandDefinition } from "../models/ICliCommandDefinition.js";
import type { IEnvironmentVariables } from "../models/IEnvironmentVariables.js";

const COMMAND_NAME = "help";

/**
 * Get the command definition parameters.
 * @param commandDefinitions The registered command definitions.
 */
export function getCommandDefinitionHelp(commandDefinitions: {
	[id: string]: ICliCommandDefinition;
}): void {
	commandDefinitions[COMMAND_NAME] = {
		command: COMMAND_NAME,
		description: I18n.formatMessage("node.cli.commands.help.description"),
		example: "",
		params: [],
		action: async (engineCore, envVars, params) =>
			help(engineCore, envVars, params, commandDefinitions),
		requiresEngineStarted: false
	};
}

/**
 * Command for displaying help information.
 * @param engineCore The engine core.
 * @param envVars The environment variables for the node.
 * @param params The command parameters.
 * @param params.command The command to display help for.
 * @param commandDefinitions The registered command definitions.
 * @returns A promise that resolves when help output has been displayed.
 */
export async function help(
	engineCore: IEngineCore,
	envVars: IEnvironmentVariables,
	params: { command?: string },
	commandDefinitions: { [id: string]: ICliCommandDefinition }
): Promise<void> {
	if (Is.stringValue(params.command)) {
		const commandDefinition = commandDefinitions[params.command];
		if (commandDefinition) {
			displayCommandHelp(commandDefinition);
		}
	} else {
		CLIDisplay.value("", I18n.formatMessage("node.cli.commands.help.labels.commands"));
		CLIDisplay.break();

		const singleTenantOnlyLabel = I18n.formatMessage(
			"node.cli.commands.help.labels.singleTenantOnly"
		);
		for (const commandId in commandDefinitions) {
			const commandDef = commandDefinitions[commandId];
			if (commandId !== "help") {
				const description = I18n.formatMessage(
					`node.cli.commands.${commandDef.command}.description`
				);
				CLIDisplay.value(
					commandDef.command,
					commandDef.singleTenantOnly ? `${description} (${singleTenantOnlyLabel})` : description
				);
			}
		}
	}
}

/**
 * Display help for a specific command.
 * @param commandDefinition The command definition.
 */
function displayCommandHelp(commandDefinition: ICliCommandDefinition): void {
	CLIDisplay.value(commandDefinition.command, commandDefinition.description);
	if (commandDefinition.singleTenantOnly) {
		CLIDisplay.value("", I18n.formatMessage("node.cli.commands.help.labels.singleTenantOnly"), 1);
	}
	CLIDisplay.break();

	const defaultLabel = I18n.formatMessage("node.cli.commands.help.labels.default");
	const optionsLabel = I18n.formatMessage("node.cli.commands.help.labels.options");
	const requiredLabel = I18n.formatMessage("node.cli.commands.help.labels.required");
	const optionalLabel = I18n.formatMessage("node.cli.commands.help.labels.optional");

	if (commandDefinition.params.length > 0) {
		for (const param of commandDefinition.params) {
			const typeParts: string[] = [param.type];
			if (Is.stringValue(param.extendedType)) {
				typeParts.push(param.extendedType);
			}
			if (Is.notEmpty(param.defaultValue)) {
				typeParts.push(`${defaultLabel}: '${param.defaultValue}'`);
			}
			// Match the command line parser, which treats a param without a required flag as required
			if (param.required ?? true) {
				typeParts.push(requiredLabel);
			} else {
				typeParts.push(optionalLabel);
			}

			if (Is.arrayValue(param.options)) {
				typeParts.push(`${optionsLabel}: [${param.options.join(", ")}]`);
			}

			CLIDisplay.value(param.key, `(${typeParts.join(", ")})`, 1);

			CLIDisplay.value("", param.description, 1);

			CLIDisplay.break();
		}
	}

	if (Is.arrayValue(commandDefinition.aliases)) {
		CLIDisplay.break();
		CLIDisplay.value(
			I18n.formatMessage("node.cli.commands.help.labels.aliases"),
			commandDefinition.aliases.join(", ")
		);
	}

	if (Is.stringValue(commandDefinition.example)) {
		CLIDisplay.break();
		CLIDisplay.value(
			I18n.formatMessage("node.cli.commands.help.labels.example"),
			commandDefinition.example
		);
	}
}
