// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type {
	IAuthenticationAdminComponent,
	IAuthenticationUser
} from "@twin.org/api-auth-entity-storage-models";
import { CLIDisplay } from "@twin.org/cli-core";
import { ComponentFactory, Guards, I18n, Is } from "@twin.org/core";
import type { IEngineCore } from "@twin.org/engine-models";
import { Did, IdentityProfileConnectorFactory } from "@twin.org/identity-models";
import type { Person, WithContext } from "schema-dts";
import type { ICliCommandDefinition } from "../models/ICliCommandDefinition.js";
import type { INodeEnvironmentVariables } from "../models/INodeEnvironmentVariables.js";

const COMMAND_NAME = "user-update";

/**
 * Get the command definition parameters.
 * @param commandDefinitions The registered command definitions.
 */
export function getCommandDefinitionUserUpdate(commandDefinitions: {
	[id: string]: ICliCommandDefinition;
}): void {
	commandDefinitions[COMMAND_NAME] = {
		command: COMMAND_NAME,
		description: I18n.formatMessage("node.cli.commands.user-update.description"),
		example: I18n.formatMessage("node.cli.commands.user-update.example"),
		params: [
			{
				key: "env-prefix",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.user-update.params.env-prefix.description"
				),
				required: false
			},
			{
				key: "user-identity",
				type: "string",
				extendedType: "DID",
				description: I18n.formatMessage(
					"node.cli.commands.user-update.params.user-identity.description"
				),
				required: false
			},
			{
				key: "organization-identity",
				type: "string",
				extendedType: "DID",
				description: I18n.formatMessage(
					"node.cli.commands.user-update.params.organization-identity.description"
				),
				required: false
			},
			{
				key: "email",
				type: "string",
				extendedType: "email",
				description: I18n.formatMessage("node.cli.commands.user-update.params.email.description")
			},
			{
				key: "scope",
				type: "string",
				description: I18n.formatMessage("node.cli.commands.user-update.params.scope.description"),
				required: false
			},
			{
				key: "given-name",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.user-update.params.given-name.description"
				),
				required: false
			},
			{
				key: "family-name",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.user-update.params.family-name.description"
				),
				required: false
			},
			{
				key: "load-env",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.user-update.params.load-env.description"
				),
				required: false
			}
		],
		action: async (engineCore, envVars, params) => userUpdate(engineCore, envVars, params)
	};
}

/**
 * Command for creating a user.
 * @param engineCore The engine core.
 * @param envVars The environment variables for the node.
 * @param params The parameters for the command.
 * @param params.userIdentity The DID for the user.
 * @param params.organizationIdentity The organization DID for the user.
 * @param params.email The email for the user.
 * @param params.scope The scope for the user.
 * @param params.givenName The given name for the user.
 * @param params.familyName The family name for the user.
 * @returns The updated user details or undefined if skipped.
 */
export async function userUpdate(
	engineCore: IEngineCore,
	envVars: INodeEnvironmentVariables,
	params: {
		userIdentity?: string;
		organizationIdentity?: string;
		email?: string;
		scope?: string;
		givenName?: string;
		familyName?: string;
	}
): Promise<
	| {
			did: string;
			organizationDid: string;
			email: string;
			scope: string[];
			givenName: string;
			familyName: string;
	  }
	| undefined
> {
	Guards.email("userUpdate", "email", params.email);

	if (Is.stringValue(params.userIdentity)) {
		Did.guard("userUpdate", "user-identity", params.userIdentity);
	}
	if (Is.stringValue(params.organizationIdentity)) {
		Did.guard("userUpdate", "organization-identity", params.organizationIdentity);
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

	CLIDisplay.task(I18n.formatMessage("node.cli.commands.user-update.labels.updating"));

	const user: Partial<Omit<IAuthenticationUser, "password" | "salt">> = {
		email: params.email,
		userIdentity: params.userIdentity,
		organizationIdentity: params.organizationIdentity,
		scope: params.scope?.split(",").map(s => s.trim())
	};

	CLIDisplay.task(I18n.formatMessage("node.cli.commands.user-update.labels.storingUser"));

	const existingUser = await authenticationAdminComponent.get(params.email);

	await authenticationAdminComponent.update(user);

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
		email: params.email
	};

	CLIDisplay.task(I18n.formatMessage("node.cli.commands.user-update.labels.storingProfile"));
	await identityProfileConnector.update(existingUser.userIdentity, publicProfile, privateProfile);

	CLIDisplay.task(I18n.formatMessage("node.cli.commands.user-update.labels.userUpdated"));

	CLIDisplay.break();

	const json = {
		did: params.userIdentity ?? existingUser.userIdentity,
		organizationDid: params.organizationIdentity ?? existingUser.organizationIdentity,
		email: params.email,
		scope: params.scope?.split(",").map(s => s.trim()) ?? existingUser.scope,
		givenName: params.givenName ?? "",
		familyName: params.familyName ?? ""
	};

	CLIDisplay.done();

	return json;
}
