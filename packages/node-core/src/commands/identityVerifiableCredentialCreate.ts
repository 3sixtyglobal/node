// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import path from "node:path";
import { CLIDisplay, CLIUtils } from "@twin.org/cli-core";
import { Coerce, GeneralError, Guards, I18n, Is } from "@twin.org/core";
import type { IJsonLdNodeObject } from "@twin.org/data-json-ld";
import type { IEngineCore } from "@twin.org/engine-models";
import { Did, IdentityConnectorFactory } from "@twin.org/identity-models";
import type { IDidVerifiableCredential } from "@twin.org/standards-w3c-did";
import type { ICliCommandDefinition } from "../models/ICliCommandDefinition.js";
import type { INodeEngineConfig } from "../models/INodeEngineConfig.js";
import type { INodeEngineState } from "../models/INodeEngineState.js";
import type { INodeEnvironmentVariables } from "../models/INodeEnvironmentVariables.js";

const COMMAND_NAME = "identity-verifiable-credential-create";

/**
 * Get the command definition parameters.
 * @param commandDefinitions The registered command definitions.
 */
export function getCommandDefinitionIdentityVerifiableCredentialCreate(commandDefinitions: {
	[id: string]: ICliCommandDefinition;
}): void {
	commandDefinitions[COMMAND_NAME] = {
		command: COMMAND_NAME,
		description: I18n.formatMessage(
			"node.cli.commands.identity-verifiable-credential-create.description"
		),
		example: I18n.formatMessage("node.cli.commands.identity-verifiable-credential-create.example"),
		requiresNodeIdentity: false,
		requiresTenantId: false,
		params: [
			{
				key: "identity",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.identity-verifiable-credential-create.params.identity.description"
				),
				extendedType: "did"
			},
			{
				key: "controller",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.identity-verifiable-credential-create.params.controller.description"
				),
				extendedType: "did",
				required: false
			},
			{
				key: "verification-method-id",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.identity-verifiable-credential-create.params.verification-method-id.description"
				),
				extendedType: "did with fragment"
			},
			{
				key: "subject-json",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.identity-verifiable-credential-create.params.subject-json.description"
				),
				extendedType: "file",
				required: true
			},
			{
				key: "credential-id",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.identity-verifiable-credential-create.params.credential-id.description"
				),
				extendedType: "url",
				required: false
			},
			{
				key: "expiration-date",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.identity-verifiable-credential-create.params.expiration-date.description"
				),
				extendedType: "ISO date-time",
				required: false
			},
			{
				key: "load-env",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.identity-verifiable-credential-create.params.load-env.description"
				),
				required: false
			},
			{
				key: "output-json",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.identity-verifiable-credential-create.params.output-json.description"
				),
				required: false
			},
			{
				key: "output-env",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.identity-verifiable-credential-create.params.output-env.description"
				),
				required: false
			},
			{
				key: "output-env-prefix",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.identity-verifiable-credential-create.params.output-env-prefix.description"
				),
				required: false
			}
		],
		action: async (engineCore, envVars, params) =>
			identityVerifiableCredentialCreate(engineCore, envVars, params)
	};
}

/**
 * Command for creating an identity verifiable credential.
 * @param engineCore The engine core.
 * @param envVars The environment variables for the node.
 * @param params The parameters for the command.
 * @param params.verificationMethodId The ID of the verification method to create the credential with.
 * @param params.identity The DID of the identity to create the credential for.
 * @param params.controller The controller DID for the identity.
 * @param params.subjectJson The subject JSON file for the verifiable credential.
 * @param params.credentialId The ID of the verifiable credential.
 * @param params.expirationDate The expiration date of the verifiable credential.
 * @param params.outputJson The output .json file to store the command output.
 * @param params.outputEnv The output .env file to store the command output.
 * @param params.outputEnvPrefix The prefix to use for variables in the output .env file.
 * @returns The created verifiable credential and JWT.
 */
export async function identityVerifiableCredentialCreate(
	engineCore: IEngineCore<INodeEngineConfig, INodeEngineState>,
	envVars: INodeEnvironmentVariables,
	params: {
		verificationMethodId?: string;
		identity?: string;
		controller?: string;
		subjectJson?: string;
		credentialId?: string;
		expirationDate?: string;
		outputJson?: string;
		outputEnv?: string;
		outputEnvPrefix?: string;
	}
): Promise<{
	verifiableCredential: IDidVerifiableCredential;
	jwt: string;
}> {
	Did.guard("identityVerifiableCredentialCreate", "identity", params.identity);
	Guards.stringValue(
		"identityVerifiableCredentialCreate",
		"verification-method-id",
		params.verificationMethodId
	);
	Guards.stringValue("identityVerifiableCredentialCreate", "subject-json", params.subjectJson);

	const defaultIdentityConnectorType = engineCore.getRegisteredInstanceType("identityConnector");
	const identityConnector = IdentityConnectorFactory.get(defaultIdentityConnectorType);

	const subjectFilename = path.resolve(params.subjectJson);
	const subject = await CLIUtils.readJsonFile<IJsonLdNodeObject>(subjectFilename);
	if (Is.empty(subject)) {
		throw new GeneralError("identityVerifiableCredentialCreate", "subjectJsonLoadFailed", {
			subjectFilename
		});
	}

	CLIDisplay.task(
		I18n.formatMessage("node.cli.commands.identity-verifiable-credential-create.labels.creating")
	);

	CLIDisplay.spinnerStart();

	if (!params.verificationMethodId.includes("#")) {
		params.verificationMethodId = `${params.identity}#${params.verificationMethodId}`;
	}

	const credential = await identityConnector.createVerifiableCredential(
		params.controller ?? params.identity,
		params.verificationMethodId,
		params.credentialId,
		subject,
		{
			expirationDate: Coerce.dateTime(params.expirationDate)
		}
	);

	CLIDisplay.spinnerStop();
	CLIDisplay.task(
		I18n.formatMessage("node.cli.commands.identity-verifiable-credential-create.labels.created")
	);

	CLIDisplay.break();

	CLIDisplay.value(
		I18n.formatMessage("node.cli.commands.identity-verifiable-credential-create.labels.jwtToken"),
		credential.jwt
	);
	CLIDisplay.break();

	if (Is.stringValue(params.outputJson)) {
		await CLIUtils.writeJsonFile(params.outputJson, credential, false);
	}

	if (Is.stringValue(params.outputEnv)) {
		const output = [`${params.outputEnvPrefix}VC_TOKEN="${credential.jwt}"`];
		await CLIUtils.writeEnvFile(params.outputEnv, output, false);
	}

	CLIDisplay.done();

	return credential;
}
