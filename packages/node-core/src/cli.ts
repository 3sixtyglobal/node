// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { CLIDisplay } from "@twin.org/cli-core";
import { ContextIdStore } from "@twin.org/context";
import { Coerce, GeneralError, I18n, Is, StringHelper } from "@twin.org/core";
import type { IEngineCore } from "@twin.org/engine-models";
import * as dotenv from "dotenv";
import { getCommandDefinitionBootstrapLegacy } from "./commands/bootstrapLegacy.js";
import { getCommandDefinitionHelp } from "./commands/help.js";
import { getCommandDefinitionIdentityCreate } from "./commands/identityCreate.js";
import { getCommandDefinitionIdentityImport } from "./commands/identityImports.js";
import { getCommandDefinitionIdentityVerifiableCredentialCreate } from "./commands/identityVerifiableCredentialCreate.js";
import { getCommandDefinitionIdentityVerificationMethodCreate } from "./commands/identityVerificationMethodCreate.js";
import { getCommandDefinitionIdentityVerificationMethodImport } from "./commands/identityVerificationMethodImport.js";
import { getCommandDefinitionNodeSetIdentity } from "./commands/nodeSetIdentity.js";
import { getCommandDefinitionNodeSetTenant } from "./commands/nodeSetTenant.js";
import { getCommandDefinitionTenantCreate } from "./commands/tenantCreate.js";
import { getCommandDefinitionTenantImport } from "./commands/tenantImport.js";
import { getCommandDefinitionTenantToken } from "./commands/tenantToken.js";
import { getCommandDefinitionTenantUpdate } from "./commands/tenantUpdate.js";
import { getCommandDefinitionUserCreate } from "./commands/userCreate.js";
import { getCommandDefinitionUserUpdate } from "./commands/userUpdate.js";
import { getCommandDefinitionVaultKeyCreate } from "./commands/vaultKeyCreate.js";
import { getCommandDefinitionVaultKeyImport } from "./commands/vaultKeyImport.js";
import type { CliCommandParamType } from "./models/cliCommandParamType.js";
import type { ICliArgs } from "./models/ICliArgs.js";
import type { ICliCommand } from "./models/ICliCommand.js";
import type { ICliCommandDefinition } from "./models/ICliCommandDefinition.js";
import type { INodeEnvironmentVariables } from "./models/INodeEnvironmentVariables.js";

const commandDefinitions: { [id: string]: ICliCommandDefinition } = {};

/**
 * Parse command line arguments.
 * @param args The command line arguments.
 * @returns The parsed command line arguments.
 */
export function parseCommandLineArgs(args?: string[]): ICliArgs {
	let nodePath;
	let scriptPath;
	let options:
		| {
				key: string;
				value: string;
		  }[]
		| undefined;

	if (Is.arrayValue(args)) {
		if (args.length > 0) {
			nodePath = args[0];
		}
		if (args.length > 1) {
			scriptPath = args[1];
		}
		if (args.length > 2) {
			options = [];

			for (let i = 2; i < args.length; i++) {
				const arg = args[i];
				const equalIndex = arg.indexOf("=");
				if (equalIndex > 0) {
					const key = arg.slice(0, equalIndex).trim();
					const value = arg.slice(equalIndex + 1).trim();
					if (key.startsWith("--")) {
						options.push({ key: key.slice(2), value });
					}
				} else {
					options.push({ key: arg, value: "" });
				}
			}
		}
	}

	return {
		nodePath,
		scriptPath,
		options
	};
}

/**
 * Construct the CLI command from the parsed arguments.
 * @param processEnv The environment variables from the process.
 * @param cliArgs The parsed CLI arguments.
 * @returns The constructed CLI command.
 * @throws GeneralError if the command is missing.
 */
export function constructCliCommand(
	processEnv: {
		[id: string]: string;
	},
	cliArgs: ICliArgs
): ICliCommand | undefined {
	if (Is.arrayValue(cliArgs.options)) {
		const command = cliArgs.options[0];

		// If the first option is --help, we can display help for all commands
		if (command.key === "--help") {
			return {
				definition: commandDefinitions.help,
				params: {}
			};
		}

		// In cases where no command but env-prefix is provided, we just return
		if (command.key === "env-prefix") {
			return undefined;
		}

		if (!commandDefinitions[command.key]) {
			throw new GeneralError("node", "cliCommandMissing", { command: command.key });
		}

		// We have a valid command, check for --help for that command
		const hasHelp = cliArgs.options.find(option => option.key === "--help");
		if (hasHelp) {
			return {
				definition: commandDefinitions.help,
				params: {
					command: command.key
				}
			};
		}

		processEnvOptions(processEnv, cliArgs.options);

		const cliParams: { [id: string]: CliCommandParamType } = {};
		const allParamKeys = cliArgs.options
			.map(option => option.key)
			.filter(key => key !== command.key);

		for (const commandDefParam of commandDefinitions[command.key].params) {
			const foundParamIndex =
				cliArgs.options?.findIndex(option => option.key === commandDefParam.key) ?? -1;
			const foundParam = foundParamIndex >= 0 ? cliArgs.options?.[foundParamIndex] : undefined;

			let paramValue;
			if (commandDefParam.type === "number") {
				paramValue = Coerce.number(foundParam?.value ?? commandDefParam.defaultValue);
			} else if (commandDefParam.type === "boolean") {
				paramValue = Coerce.boolean(foundParam?.value ?? commandDefParam.defaultValue);
			} else {
				paramValue = Coerce.string(foundParam?.value ?? commandDefParam.defaultValue);
			}

			const required = commandDefParam.required ?? true;
			if (Is.empty(paramValue) && required) {
				throw new GeneralError("node", "cliCommandParamMissing", {
					command: command.key,
					param: commandDefParam.key
				});
			}

			if (!Is.empty(paramValue)) {
				cliParams[StringHelper.camelCase(commandDefParam.key)] = paramValue;
			}

			if (foundParamIndex >= 0) {
				allParamKeys.splice(allParamKeys.indexOf(commandDefParam.key), 1);
			}
		}

		if (allParamKeys.length > 0) {
			throw new GeneralError("node", "cliCommandParamExtra", {
				command: command.key,
				params: allParamKeys.join(", ")
			});
		}

		if (commandDefinitions[command.key].params.find(param => param.key === "output-env-prefix")) {
			cliParams.outputEnvPrefix = (Coerce.string(cliParams.outputEnvPrefix) ?? "").toUpperCase();
			cliParams.outputEnvPrefix =
				cliParams.outputEnvPrefix.length > 0 && !cliParams.outputEnvPrefix.endsWith("_")
					? `${cliParams.outputEnvPrefix}_`
					: cliParams.outputEnvPrefix;
		}

		return {
			definition: commandDefinitions[command.key],
			params: cliParams
		};
	}
}

/**
 * Execute the CLI command.
 * @param engineCore The engine core.
 * @param envVars The environment variables for the node.
 * @param cliCommand The CLI command to execute.
 */
export async function executeCommand(
	engineCore: IEngineCore,
	envVars: INodeEnvironmentVariables,
	cliCommand: ICliCommand
): Promise<void> {
	const requiresEngineStarted = cliCommand.definition.requiresEngineStarted ?? true;

	try {
		if (requiresEngineStarted) {
			await engineCore.start(true);
		}

		CLIDisplay.value(
			I18n.formatMessage("node.cli.commands.command"),
			cliCommand.definition.command
		);
		for (const paramKey in cliCommand.params) {
			CLIDisplay.value(paramKey, Coerce.string(cliCommand.params[paramKey]), 1);
		}
		CLIDisplay.break();

		await ContextIdStore.run(engineCore.getContextIds() ?? {}, async () => {
			await cliCommand.definition.action(engineCore, envVars, cliCommand.params);
		});
	} catch (error) {
		CLIDisplay.spinnerStop();

		throw error;
	} finally {
		if (requiresEngineStarted) {
			CLIDisplay.break();
			await engineCore.stop();
		}
	}
}

/**
 * Load the env files and process the options.
 * @param processEnv The environment variables from the process.
 * @param options The options.
 * @returns The processed parameters.
 * @throws GeneralError if an env file has errors.
 */
export function processEnvOptions(
	processEnv: {
		[id: string]: string;
	},
	options: {
		key: string;
		value: string;
	}[]
): void {
	const inputEnv = options.find(option => option.key === "load-env")?.value;

	if (Is.stringValue(inputEnv)) {
		const envFiles = inputEnv.split(",").map(f => f.trim());
		for (const envFile of envFiles) {
			const output = dotenv.config({
				path: envFile,
				quiet: true
			});

			if (output.error) {
				throw output.error;
			}

			if (Is.objectValue(output.parsed)) {
				for (const key in output.parsed) {
					processEnv[key] = output.parsed[key];
				}
			}
		}
	}

	return substituteEnvOptions(processEnv, options);
}

/**
 * Process options and replace any env variables with their values.
 * @param processEnv The environment variables from the process.
 * @param options The options.
 * @throws GeneralError if an env variable is missing.
 */
export function substituteEnvOptions(
	processEnv: {
		[id: string]: string;
	},
	options: {
		key: string;
		value: string;
	}[]
): void {
	for (const option of options) {
		if (option.value.startsWith("!")) {
			const envVar = processEnv[option.value.slice(1)];
			if (!Is.stringValue(envVar)) {
				throw new GeneralError("node", "cliEnvVarMissing", { envVar: option.value.slice(1) });
			}
			option.value = envVar;
		}
	}
}

/**
 * Register available CLI commands.
 */
export function registerCommands(): void {
	getCommandDefinitionHelp(commandDefinitions);
	getCommandDefinitionBootstrapLegacy(commandDefinitions);
	getCommandDefinitionIdentityCreate(commandDefinitions);
	getCommandDefinitionIdentityImport(commandDefinitions);
	getCommandDefinitionIdentityVerificationMethodCreate(commandDefinitions);
	getCommandDefinitionIdentityVerificationMethodImport(commandDefinitions);
	getCommandDefinitionIdentityVerifiableCredentialCreate(commandDefinitions);
	getCommandDefinitionNodeSetIdentity(commandDefinitions);
	getCommandDefinitionNodeSetTenant(commandDefinitions);
	getCommandDefinitionTenantCreate(commandDefinitions);
	getCommandDefinitionTenantImport(commandDefinitions);
	getCommandDefinitionTenantToken(commandDefinitions);
	getCommandDefinitionTenantUpdate(commandDefinitions);
	getCommandDefinitionUserCreate(commandDefinitions);
	getCommandDefinitionUserUpdate(commandDefinitions);
	getCommandDefinitionVaultKeyCreate(commandDefinitions);
	getCommandDefinitionVaultKeyImport(commandDefinitions);
}
