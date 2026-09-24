// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IAuthenticationAdminComponent } from "@twin.org/api-auth-entity-storage-models";
import { CLIDisplay, CLIUtils } from "@twin.org/cli-core";
import { ContextIdKeys, ContextIdStore } from "@twin.org/context";
import { Coerce, ComponentFactory, GeneralError, Guards, I18n, Is } from "@twin.org/core";
import { PasswordGenerator } from "@twin.org/crypto";
import type { IEngineCore } from "@twin.org/engine-models";
import type { ICliCommandDefinition } from "../models/ICliCommandDefinition.js";
import type { IEnvironmentVariables } from "../models/IEnvironmentVariables.js";

const COMMAND_NAME = "user-update-password";

const GENERATED_PASSWORD_LENGTH = 16;

/**
 * Get the command definition parameters.
 * @param commandDefinitions The registered command definitions.
 */
export function getCommandDefinitionUserUpdatePassword(commandDefinitions: {
	[id: string]: ICliCommandDefinition;
}): void {
	commandDefinitions[COMMAND_NAME] = {
		command: COMMAND_NAME,
		description: I18n.formatMessage("node.cli.commands.user-update-password.description"),
		example: I18n.formatMessage("node.cli.commands.user-update-password.example"),
		params: [
			{
				key: "env-prefix",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.user-update-password.params.env-prefix.description"
				),
				required: false
			},
			{
				key: "email",
				type: "string",
				extendedType: "email",
				description: I18n.formatMessage(
					"node.cli.commands.user-update-password.params.email.description"
				)
			},
			{
				key: "password",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.user-update-password.params.password.description"
				),
				required: false
			},
			{
				key: "current-password",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.user-update-password.params.current-password.description"
				),
				required: false
			},
			{
				key: "tenant-id",
				type: "string",
				extendedType: "hex(32)",
				description: I18n.formatMessage(
					"node.cli.commands.user-update-password.params.tenant-id.description"
				),
				required: false
			},
			{
				key: "load-env",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.user-update-password.params.load-env.description"
				),
				required: false
			},
			{
				key: "output-json",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.user-update-password.params.output-json.description"
				),
				required: false
			},
			{
				key: "output-env",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.user-update-password.params.output-env.description"
				),
				required: false
			},
			{
				key: "output-env-prefix",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.user-update-password.params.output-env-prefix.description"
				),
				required: false
			}
		],
		action: async (engineCore, envVars, params) => userUpdatePassword(engineCore, envVars, params)
	};
}

/**
 * Command for updating the password of a user.
 * @param engineCore The engine core.
 * @param envVars The environment variables for the node.
 * @param params The parameters for the command.
 * @param params.email The email address of the user to update.
 * @param params.password The new password, a random one is generated if not provided.
 * @param params.currentPassword The current password, verified before the change when provided.
 * @param params.tenantId The tenant ID for the user (multi-tenant mode only).
 * @param params.outputJson The output .json file to store the command output.
 * @param params.outputEnv The output .env file to store the command output.
 * @param params.outputEnvPrefix The prefix to use for variables in the output .env file.
 * @returns The email and the new password.
 */
export async function userUpdatePassword(
	engineCore: IEngineCore,
	envVars: IEnvironmentVariables,
	params: {
		email?: string;
		password?: string;
		currentPassword?: string;
		tenantId?: string;
		outputJson?: string;
		outputEnv?: string;
		outputEnvPrefix?: string;
	}
): Promise<{ email: string; password: string }> {
	const paramsEmail = params.email;
	Guards.email("userUpdatePassword", "email", paramsEmail);
	const tenantEnabled = Coerce.boolean(envVars.tenantEnabled) ?? false;
	if (Is.stringValue(params.tenantId)) {
		if (!tenantEnabled) {
			throw new GeneralError("userUpdatePassword", "tenantIdNotAllowed");
		}
		Guards.stringHexLength("userUpdatePassword", "tenant-id", params.tenantId, 32);
	} else if (tenantEnabled) {
		throw new GeneralError("userUpdatePassword", "tenantIdRequired");
	}

	const defaultAuthenticationAdminComponentType = engineCore.getRegisteredInstanceType(
		"authenticationAdminComponent"
	);
	const authenticationAdminComponent = ComponentFactory.get<IAuthenticationAdminComponent>(
		defaultAuthenticationAdminComponentType
	);

	const newPassword = params.password ?? PasswordGenerator.generate(GENERATED_PASSWORD_LENGTH);

	const currentContextIds = (await ContextIdStore.getContextIds()) ?? {};
	await ContextIdStore.run(
		{ ...currentContextIds, [ContextIdKeys.Tenant]: params.tenantId },
		async () => {
			CLIDisplay.task(I18n.formatMessage("node.cli.commands.user-update-password.labels.updating"));
			await authenticationAdminComponent.updatePassword(
				paramsEmail,
				newPassword,
				params.currentPassword
			);
		}
	);

	CLIDisplay.task(I18n.formatMessage("node.cli.commands.user-update-password.labels.updated"));
	CLIDisplay.value(
		I18n.formatMessage("node.cli.commands.user-update-password.labels.email"),
		paramsEmail
	);
	CLIDisplay.value(
		I18n.formatMessage("node.cli.commands.user-update-password.labels.password"),
		newPassword
	);
	CLIDisplay.break();

	const json = { email: paramsEmail, password: newPassword };

	if (Is.stringValue(params.outputJson)) {
		await CLIUtils.writeJsonFile(params.outputJson, json, false);
	}

	if (Is.stringValue(params.outputEnv)) {
		await CLIUtils.writeEnvFile(
			params.outputEnv,
			[
				`${params.outputEnvPrefix}EMAIL="${paramsEmail}"`,
				`${params.outputEnvPrefix}PASSWORD="${newPassword}"`
			],
			false
		);
	}

	CLIDisplay.done();

	return json;
}
