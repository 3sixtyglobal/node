// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type {
	IAuthenticationAdminComponent,
	IAuthenticationUser
} from "@twin.org/api-auth-entity-storage-models";
import { CLIDisplay, CLIUtils } from "@twin.org/cli-core";
import { ContextIdKeys, ContextIdStore } from "@twin.org/context";
import { Coerce, ComponentFactory, GeneralError, Guards, I18n, Is } from "@twin.org/core";
import { PasswordGenerator } from "@twin.org/crypto";
import type { IEngineCore } from "@twin.org/engine-models";
import { Did, IdentityProfileConnectorFactory } from "@twin.org/identity-models";
import type { Person, WithContext } from "schema-dts";
import type { ICliCommandDefinition } from "../models/ICliCommandDefinition.js";
import type { IEnvironmentVariables } from "../models/IEnvironmentVariables.js";

const COMMAND_NAME = "user-create";

/**
 * Get the command definition parameters.
 * @param commandDefinitions The registered command definitions.
 */
export function getCommandDefinitionUserCreate(commandDefinitions: {
	[id: string]: ICliCommandDefinition;
}): void {
	commandDefinitions[COMMAND_NAME] = {
		command: COMMAND_NAME,
		description: I18n.formatMessage("node.cli.commands.user-create.description"),
		example: I18n.formatMessage("node.cli.commands.user-create.example"),
		params: [
			{
				key: "env-prefix",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.user-create.params.env-prefix.description"
				),
				required: false
			},
			{
				key: "user-identity",
				type: "string",
				extendedType: "DID",
				description: I18n.formatMessage(
					"node.cli.commands.user-create.params.user-identity.description"
				)
			},
			{
				key: "organization-identity",
				type: "string",
				extendedType: "DID",
				description: I18n.formatMessage(
					"node.cli.commands.user-create.params.organization-identity.description"
				)
			},
			{
				key: "tenant-id",
				type: "string",
				extendedType: "hex(32)",
				description: I18n.formatMessage(
					"node.cli.commands.user-create.params.tenant-id.description"
				)
			},
			{
				key: "email",
				type: "string",
				extendedType: "email",
				description: I18n.formatMessage("node.cli.commands.user-create.params.email.description")
			},
			{
				key: "password",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.user-create.params.password.description"
				),
				required: false
			},
			{
				key: "scope",
				type: "string",
				description: I18n.formatMessage("node.cli.commands.user-create.params.scope.description"),
				required: false
			},
			{
				key: "given-name",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.user-create.params.given-name.description"
				),
				required: false
			},
			{
				key: "family-name",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.user-create.params.family-name.description"
				),
				required: false
			},
			{
				key: "overwrite-mode",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.user-create.params.overwrite-mode.description"
				),
				options: ["skip", "overwrite", "error"],
				defaultValue: "skip",
				required: false
			},
			{
				key: "load-env",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.user-create.params.load-env.description"
				),
				required: false
			},
			{
				key: "output-json",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.user-create.params.output-json.description"
				),
				required: false
			},
			{
				key: "output-env",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.user-create.params.output-env.description"
				),
				required: false
			},
			{
				key: "output-env-prefix",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.user-create.params.output-env-prefix.description"
				),
				required: false
			}
		],
		action: async (engineCore, envVars, params) => userCreate(engineCore, envVars, params)
	};
}

/**
 * Command for creating a user.
 * @param engineCore The engine core.
 * @param envVars The environment variables for the node.
 * @param params The parameters for the command.
 * @param params.userIdentity The DID for the user.
 * @param params.organizationIdentity The organization DID for the user.
 * @param params.tenantId The tenant ID for the user.
 * @param params.email The email for the user.
 * @param params.password The password for the user.
 * @param params.scope The scope for the user.
 * @param params.givenName The given name for the user.
 * @param params.familyName The family name for the user.
 * @param params.overwriteMode The mode to use when a user with the same identity already exists.
 * @param params.outputJson The output .json file to store the command output.
 * @param params.outputEnv The output .env file to store the command output.
 * @param params.outputEnvPrefix The prefix to use for variables in the output .env file.
 * @returns The created user details or undefined if skipped.
 */
export async function userCreate(
	engineCore: IEngineCore,
	envVars: IEnvironmentVariables,
	params: {
		userIdentity?: string;
		organizationIdentity?: string;
		tenantId?: string;
		email?: string;
		password?: string;
		scope?: string;
		givenName?: string;
		familyName?: string;
		overwriteMode?: "skip" | "overwrite" | "error";
		outputJson?: string;
		outputEnv?: string;
		outputEnvPrefix?: string;
	}
): Promise<
	| {
			did: string;
			organizationDid: string;
			email: string;
			password: string;
			scope: string[];
			givenName: string;
			familyName: string;
	  }
	| undefined
> {
	const paramsEmail = params.email;
	const paramsUserIdentity = params.userIdentity;
	const paramsOrganizationIdentity = params.organizationIdentity;
	Guards.email("userCreate", "email", paramsEmail);
	Did.guard("userCreate", "user-identity", paramsUserIdentity);
	Did.guard("userCreate", "organization-identity", paramsOrganizationIdentity);
	if (Is.stringValue(params.tenantId)) {
		Guards.stringHexLength("userCreate", "tenant-id", params.tenantId, 32);
	} else if (Coerce.boolean(envVars.tenantEnabled) ?? false) {
		throw new GeneralError("userCreate", "tenantIdRequired");
	}

	if (Is.stringValue(params.password) && params.password.length < 16) {
		throw new GeneralError("userCreate", "passwordTooShort", { minLength: 16 });
	}

	const defaultIdentityProfileConnectorType = engineCore.getRegisteredInstanceType(
		"identityProfileConnector"
	);
	const identityProfileConnector = IdentityProfileConnectorFactory.get(
		defaultIdentityProfileConnectorType
	);

	const defaultAuthenticationAdminComponentType = engineCore.getRegisteredInstanceType(
		"authenticationAdminComponent"
	);
	const authenticationAdminComponent = ComponentFactory.get<IAuthenticationAdminComponent>(
		defaultAuthenticationAdminComponentType
	);

	let createUser = true;

	const currentContextIds = (await ContextIdStore.getContextIds()) ?? {};
	const returnJson = await ContextIdStore.run(
		{ ...currentContextIds, [ContextIdKeys.Tenant]: params.tenantId },
		async () => {
			let existingUser: IAuthenticationUser | undefined;
			try {
				existingUser = await authenticationAdminComponent.get(paramsEmail);
			} catch {}

			if (!Is.empty(existingUser)) {
				if (params.overwriteMode === "error") {
					throw new GeneralError("userCreate", "userAlreadyExists");
				} else if (params.overwriteMode === "skip") {
					createUser = false;
					CLIDisplay.task(I18n.formatMessage("node.cli.commands.user-create.labels.skipping"));
				} else if (params.overwriteMode === "overwrite") {
					CLIDisplay.task(I18n.formatMessage("node.cli.commands.user-create.labels.overwriting"));
					const userToRemove = existingUser;
					await ContextIdStore.run(
						{ ...currentContextIds, [ContextIdKeys.Tenant]: params.tenantId },
						async () => {
							await authenticationAdminComponent.remove(userToRemove.email);
						}
					);
					await identityProfileConnector.remove(userToRemove.userIdentity);
					existingUser = undefined;
				}
			}

			let json;
			if (createUser) {
				CLIDisplay.task(I18n.formatMessage("node.cli.commands.user-create.labels.creating"));

				const user: IAuthenticationUser & { password: string } = {
					email: paramsEmail,
					password: params.password ?? PasswordGenerator.generate(16),
					userIdentity: paramsUserIdentity,
					organizationIdentity: paramsOrganizationIdentity,
					scope: params.scope?.split(",").map(s => s.trim()) ?? []
				};

				CLIDisplay.task(I18n.formatMessage("node.cli.commands.user-create.labels.storingUser"));

				await ContextIdStore.run(
					{ ...currentContextIds, [ContextIdKeys.Tenant]: params.tenantId },
					async () => {
						if (existingUser) {
							await authenticationAdminComponent.update(user);
						} else {
							await authenticationAdminComponent.create(user);
						}
					}
				);

				const name = `${params.givenName ?? ""} ${params.familyName ?? ""}`.trim();
				const publicProfile: WithContext<Person> = {
					"@context": "https://schema.org",
					"@type": "Person",
					name: name.length > 0 ? name : undefined
				};
				const privateProfile: WithContext<Person> = {
					"@context": "https://schema.org",
					"@type": "Person",
					givenName: params.givenName,
					familyName: params.familyName,
					email: paramsEmail
				};

				CLIDisplay.task(I18n.formatMessage("node.cli.commands.user-create.labels.storingProfile"));
				await identityProfileConnector.create(paramsUserIdentity, publicProfile, privateProfile);

				CLIDisplay.task(I18n.formatMessage("node.cli.commands.user-create.labels.userCreated"));

				CLIDisplay.value(
					I18n.formatMessage("node.cli.commands.user-create.labels.email"),
					user.email
				);

				CLIDisplay.value(
					I18n.formatMessage("node.cli.commands.user-create.labels.password"),
					user.password
				);

				CLIDisplay.break();

				json = {
					did: paramsUserIdentity,
					organizationDid: paramsOrganizationIdentity,
					email: paramsEmail,
					password: user.password,
					scope: params.scope?.split(",").map(s => s.trim()) ?? [],
					givenName: params.givenName ?? "",
					familyName: params.familyName ?? ""
				};

				if (Is.stringValue(params.outputJson)) {
					await CLIUtils.writeJsonFile(params.outputJson, json, false);
				}

				if (Is.stringValue(params.outputEnv)) {
					await CLIUtils.writeEnvFile(
						params.outputEnv,
						[
							`${params.outputEnvPrefix}DID="${params.userIdentity}"`,
							`${params.outputEnvPrefix}ORGANIZATION_DID="${params.organizationIdentity}"`,
							`${params.outputEnvPrefix}EMAIL="${paramsEmail}"`,
							`${params.outputEnvPrefix}PASSWORD="${user.password}"`,
							`${params.outputEnvPrefix}SCOPE="${params.scope ?? ""}"`,
							`${params.outputEnvPrefix}GIVEN_NAME="${params.givenName ?? ""}"`,
							`${params.outputEnvPrefix}FAMILY_NAME="${params.familyName ?? ""}"`
						],
						false
					);
				}
			}

			CLIDisplay.done();

			return json;
		}
	);

	return returnJson;
}
