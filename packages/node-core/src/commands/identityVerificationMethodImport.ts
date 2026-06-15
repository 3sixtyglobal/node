// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { CLIDisplay } from "@twin.org/cli-core";
import { Converter, GeneralError, Guards, HexHelper, I18n, Is } from "@twin.org/core";
import { Ed25519 } from "@twin.org/crypto";
import type { IEngineCore } from "@twin.org/engine-models";
import {
	Did,
	DocumentHelper,
	IdentityConnectorFactory,
	IdentityResolverConnectorFactory
} from "@twin.org/identity-models";
import { DidVerificationMethodType } from "@twin.org/standards-w3c-did";
import { VaultConnectorFactory, VaultKeyType } from "@twin.org/vault-models";
import type { ICliCommandDefinition } from "../models/ICliCommandDefinition.js";
import type { INodeEngineConfig } from "../models/INodeEngineConfig.js";
import type { INodeEngineState } from "../models/INodeEngineState.js";
import type { INodeEnvironmentVariables } from "../models/INodeEnvironmentVariables.js";

const COMMAND_NAME = "identity-verification-method-import";

/**
 * Get the command definition parameters.
 * @param commandDefinitions The registered command definitions.
 */
export function getCommandDefinitionIdentityVerificationMethodImport(commandDefinitions: {
	[id: string]: ICliCommandDefinition;
}): void {
	commandDefinitions[COMMAND_NAME] = {
		command: COMMAND_NAME,
		description: I18n.formatMessage(
			"node.cli.commands.identity-verification-method-import.description"
		),
		example: I18n.formatMessage("node.cli.commands.identity-verification-method-import.example"),
		requiresNodeIdentity: false,
		requiresOrgIdentity: false,
		params: [
			{
				key: "env-prefix",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.identity-verification-method-import.params.env-prefix.description"
				),
				required: false
			},
			{
				key: "identity",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.identity-verification-method-import.params.identity.description"
				),
				extendedType: "did"
			},
			{
				key: "controller",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.identity-verification-method-import.params.controller.description"
				),
				extendedType: "did",
				required: false
			},
			{
				key: "verification-method-type",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.identity-verification-method-import.params.verification-method-type.description"
				),
				options: Object.values(DidVerificationMethodType),
				required: true,
				defaultValue: "assertionMethod"
			},
			{
				key: "verification-method-id",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.identity-verification-method-import.params.verification-method-id.description"
				),
				required: true
			},
			{
				key: "private-key-hex",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.identity-verification-method-import.params.private-key-hex.description"
				),
				required: true
			},
			{
				key: "load-env",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.identity-verification-method-import.params.load-env.description"
				),
				required: false
			}
		],
		action: async (engineCore, envVars, params) =>
			identityVerificationMethodImport(engineCore, envVars, params)
	};
}

/**
 * Command for importing an existing key as a verification method on an identity document.
 * @param engineCore The engine core.
 * @param envVars The environment variables for the node.
 * @param params The parameters for the command.
 * @param params.identity The DID of the identity to create.
 * @param params.verificationMethodType The type of verification method to create.
 * @param params.verificationMethodId The ID of the verification method to create.
 * @param params.controller The controller DID for the identity.
 * @param params.privateKeyHex The private key in hex format.
 * @returns A promise that resolves when the verification method has been imported.
 */
export async function identityVerificationMethodImport(
	engineCore: IEngineCore<INodeEngineConfig, INodeEngineState>,
	envVars: INodeEnvironmentVariables,
	params: {
		identity?: string;
		verificationMethodType?: DidVerificationMethodType;
		verificationMethodId?: string;
		controller?: string;
		privateKeyHex?: string;
	}
): Promise<void> {
	Did.guard("identityVerificationMethodImport", "identity", params.identity);
	Guards.arrayOneOf(
		"identityVerificationMethodImport",
		"verification-method-type",
		params.verificationMethodType,
		Object.values(DidVerificationMethodType)
	);
	Guards.stringValue(
		"identityVerificationMethodImport",
		"verification-method-id",
		params.verificationMethodId
	);
	Guards.stringHex(
		"identityVerificationMethodImport",
		"private-key-hex",
		params.privateKeyHex,
		true
	);
	const defaultIdentityConnectorType = engineCore.getRegisteredInstanceType("identityConnector");
	const identityConnector = IdentityConnectorFactory.get(defaultIdentityConnectorType);

	const defaultIdentityResolverConnectorType = engineCore.getRegisteredInstanceType(
		"identityResolverConnector"
	);

	const identityResolverConnector = IdentityResolverConnectorFactory.get(
		defaultIdentityResolverConnectorType
	);

	CLIDisplay.task(
		I18n.formatMessage(
			"node.cli.commands.identity-verification-method-import.labels.resolvingIdentity"
		)
	);
	const identityDocument = await identityResolverConnector.resolveDocument(params.identity);

	if (Is.empty(identityDocument)) {
		throw new GeneralError("identityImport", "identityNotFound", {
			identity: params.identity
		});
	}

	const defaultVaultConnectorType = engineCore.getRegisteredInstanceType("vaultConnector");
	const vaultConnector = VaultConnectorFactory.get(defaultVaultConnectorType);

	CLIDisplay.task(
		I18n.formatMessage("node.cli.commands.identity-verification-method-import.labels.importing")
	);
	CLIDisplay.spinnerStart();

	let verificationMethodId = params.verificationMethodId;
	if (verificationMethodId.includes("#")) {
		const parts = DocumentHelper.parseId(verificationMethodId);
		if (Is.stringValue(parts.fragment)) {
			verificationMethodId = parts.fragment;
		}
	}

	let vaultKey;
	const vaultKeyId = `${params.identity}/${verificationMethodId}`;

	try {
		vaultKey = await vaultConnector.getKey(vaultKeyId);
	} catch {}

	if (Is.empty(vaultKey)) {
		const privateKeyBytes = Converter.hexToBytes(HexHelper.stripPrefix(params.privateKeyHex));
		const publicKeyBytes = Ed25519.publicKeyFromPrivateKey(privateKeyBytes);
		await vaultConnector.addKey(vaultKeyId, VaultKeyType.Ed25519, privateKeyBytes, publicKeyBytes);
	}

	await identityConnector.addVerificationMethod(
		params.controller ?? params.identity,
		params.identity,
		params.verificationMethodType as DidVerificationMethodType,
		verificationMethodId
	);

	CLIDisplay.spinnerStop();
	CLIDisplay.task(
		I18n.formatMessage("node.cli.commands.identity-verification-method-import.labels.imported")
	);
	CLIDisplay.break();

	CLIDisplay.done();
}
