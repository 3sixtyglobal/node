// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { CLIDisplay, CLIUtils } from "@twin.org/cli-core";
import { ComponentFactory, Converter, GeneralError, Guards, I18n, Is } from "@twin.org/core";
import type { IEngineCore } from "@twin.org/engine-models";
import {
	Did,
	DocumentHelper,
	IdentityConnectorFactory,
	type IIdentityResolverComponent
} from "@twin.org/identity-models";
import { DidVerificationMethodType } from "@twin.org/standards-w3c-did";
import { VaultConnectorFactory } from "@twin.org/vault-models";
import { type IJwk, Jwk } from "@twin.org/web";
import type { ICliCommandDefinition } from "../models/ICliCommandDefinition.js";
import type { INodeEngineConfig } from "../models/INodeEngineConfig.js";
import type { INodeEngineState } from "../models/INodeEngineState.js";
import type { INodeEnvironmentVariables } from "../models/INodeEnvironmentVariables.js";

const COMMAND_NAME = "identity-verification-method-create";

/**
 * Get the command definition parameters.
 * @param commandDefinitions The registered command definitions.
 */
export function getCommandDefinitionIdentityVerificationMethodCreate(commandDefinitions: {
	[id: string]: ICliCommandDefinition;
}): void {
	commandDefinitions[COMMAND_NAME] = {
		command: COMMAND_NAME,
		description: I18n.formatMessage(
			"node.cli.commands.identity-verification-method-create.description"
		),
		example: I18n.formatMessage("node.cli.commands.identity-verification-method-create.example"),
		requiresNodeIdentity: false,
		requiresTenantId: false,
		params: [
			{
				key: "env-prefix",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.identity-verification-method-create.params.env-prefix.description"
				),
				required: false
			},
			{
				key: "identity",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.identity-verification-method-create.params.identity.description"
				),
				extendedType: "did"
			},
			{
				key: "controller",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.identity-verification-method-create.params.controller.description"
				),
				extendedType: "did",
				required: false
			},
			{
				key: "verification-method-type",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.identity-verification-method-create.params.verification-method-type.description"
				),
				options: Object.values(DidVerificationMethodType),
				required: false,
				defaultValue: "assertionMethod"
			},
			{
				key: "verification-method-id",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.identity-verification-method-create.params.verification-method-id.description"
				),
				required: false
			},
			{
				key: "overwrite-mode",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.identity-verification-method-create.params.overwrite-mode.description"
				),
				options: ["skip", "overwrite", "error"],
				defaultValue: "skip",
				required: false
			},
			{
				key: "load-env",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.identity-verification-method-create.params.load-env.description"
				),
				required: false
			},
			{
				key: "output-json",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.identity-verification-method-create.params.output-json.description"
				),
				required: false
			},
			{
				key: "output-env",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.identity-verification-method-create.params.output-env.description"
				),
				required: false
			},
			{
				key: "output-env-prefix",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.identity-verification-method-create.params.output-env-prefix.description"
				),
				required: false
			}
		],
		action: async (engineCore, envVars, params) =>
			identityVerificationMethodCreate(engineCore, envVars, params)
	};
}

/**
 * Command for creating an identity verification method.
 * @param engineCore The engine core.
 * @param envVars The environment variables for the node.
 * @param params The parameters for the command.
 * @param params.identity The DID of the identity to create.
 * @param params.verificationMethodType The type of verification method to create.
 * @param params.verificationMethodId The ID of the verification method to create.
 * @param params.controller The controller DID for the identity.
 * @param params.overwriteMode The mode to use when a verification method with the same ID already exists.
 * @param params.outputJson The output .json file to store the command output.
 * @param params.outputEnv The output .env file to store the command output.
 * @param params.outputEnvPrefix The prefix to use for variables in the output .env file.
 * @returns The created verification method details or undefined if skipped.
 */
export async function identityVerificationMethodCreate(
	engineCore: IEngineCore<INodeEngineConfig, INodeEngineState>,
	envVars: INodeEnvironmentVariables,
	params: {
		identity?: string;
		verificationMethodType?: DidVerificationMethodType;
		verificationMethodId?: string;
		controller?: string;
		overwriteMode?: "skip" | "overwrite" | "error";
		outputJson?: string;
		outputEnv?: string;
		outputEnvPrefix?: string;
	}
): Promise<
	| {
			verificationMethodId: string;
			verificationMethodType: string;
			privateKeyJwk: IJwk;
			privateKeyHex: string;
			publicKeyHex: string;
			privateKeyBase64: string;
			publicKeyBase64: string;
	  }
	| undefined
> {
	Did.guard("identityVerificationMethodCreate", "identity", params.identity);
	Guards.arrayOneOf(
		"identityVerificationMethodCreate",
		"verificationMethodType",
		params.verificationMethodType,
		Object.values(DidVerificationMethodType)
	);
	Guards.arrayOneOf("identityVerificationMethodCreate", "overwrite-mode", params.overwriteMode, [
		"skip",
		"overwrite",
		"error"
	]);

	const defaultIdentityConnectorType = engineCore.getRegisteredInstanceType("identityConnector");
	const identityConnector = IdentityConnectorFactory.get(defaultIdentityConnectorType);

	const defaultIdentityResolverComponentType = engineCore.getRegisteredInstanceType(
		"identityResolverComponent"
	);
	const identityResolverComponent = ComponentFactory.get<IIdentityResolverComponent>(
		defaultIdentityResolverComponentType
	);

	const defaultVaultConnectorType = engineCore.getRegisteredInstanceType("vaultConnector");
	const vaultConnector = VaultConnectorFactory.get(defaultVaultConnectorType);

	let createMethod = true;
	let verificationMethod;

	// We only need to perform the overwrite check if a verification method ID was provided
	// otherwise a new ID will be generated
	if (Is.stringValue(params.verificationMethodId)) {
		if (params.overwriteMode === "skip" || params.overwriteMode === "error") {
			CLIDisplay.task(
				I18n.formatMessage(
					"node.cli.commands.identity-verification-method-create.labels.resolvingIdentity"
				)
			);

			const identityDoc = await identityResolverComponent.identityResolve(params.identity);
			try {
				verificationMethod = DocumentHelper.getVerificationMethod(
					identityDoc,
					DocumentHelper.joinId(params.identity, params.verificationMethodId)
				);
			} catch {}

			if (!Is.empty(verificationMethod)) {
				if (params.overwriteMode === "error") {
					throw new GeneralError(
						"identityVerificationMethodCreate",
						"verificationMethodAlreadyExists"
					);
				}
				createMethod = false;
				CLIDisplay.task(
					I18n.formatMessage(
						"node.cli.commands.identity-verification-method-create.labels.skipping"
					)
				);
			}
		}
	}

	if (createMethod) {
		CLIDisplay.task(
			I18n.formatMessage(
				"node.cli.commands.identity-verification-method-create.labels.creatingVerificationMethod"
			)
		);
		CLIDisplay.spinnerStart();

		verificationMethod = await identityConnector.addVerificationMethod(
			params.controller ?? params.identity,
			params.identity,
			params.verificationMethodType as DidVerificationMethodType,
			params.verificationMethodId
		);

		CLIDisplay.spinnerStop();
		CLIDisplay.task(
			I18n.formatMessage(
				"node.cli.commands.identity-verification-method-create.labels.createdVerificationMethod"
			)
		);
	}

	let json;

	if (!Is.empty(verificationMethod)) {
		const keyParts = DocumentHelper.parseId(verificationMethod.id);

		const keyPair = await vaultConnector.getKey(`${params.identity}/${keyParts.fragment}`);
		const privateKeyBase64Url = Converter.bytesToBase64Url(keyPair.privateKey);
		const publicKeyBase64Url = Is.uint8Array(keyPair.publicKey)
			? Converter.bytesToBase64Url(keyPair.publicKey)
			: "";
		const privateKeyBase64 = Converter.bytesToBase64(keyPair.privateKey);
		const publicKeyBase64 = Is.uint8Array(keyPair.publicKey)
			? Converter.bytesToBase64(keyPair.publicKey)
			: "";

		const privateKeyHex = Converter.bytesToHex(keyPair.privateKey, true);
		const publicKeyHex = Is.uint8Array(keyPair.publicKey)
			? Converter.bytesToHex(keyPair.publicKey, true)
			: "";

		const jwk = await Jwk.fromEd25519Private(keyPair.privateKey);
		const kid = await Jwk.generateKid(jwk);

		CLIDisplay.break();

		CLIDisplay.value(
			I18n.formatMessage(
				"node.cli.commands.identity-verification-method-create.labels.verificationMethodId"
			),
			verificationMethod.id
		);
		CLIDisplay.value(
			I18n.formatMessage(
				"node.cli.commands.identity-verification-method-create.labels.verificationMethodType"
			),
			verificationMethod.type
		);

		CLIDisplay.value(
			I18n.formatMessage("node.cli.commands.identity-verification-method-create.labels.kid"),
			kid
		);
		CLIDisplay.value(
			I18n.formatMessage(
				"node.cli.commands.identity-verification-method-create.labels.privateKeyBase64Url"
			),
			privateKeyBase64Url
		);
		CLIDisplay.value(
			I18n.formatMessage(
				"node.cli.commands.identity-verification-method-create.labels.publicKeyBase64Url"
			),
			publicKeyBase64Url
		);
		CLIDisplay.value(
			I18n.formatMessage(
				"node.cli.commands.identity-verification-method-create.labels.privateKeyBase64"
			),
			privateKeyBase64
		);
		CLIDisplay.value(
			I18n.formatMessage(
				"node.cli.commands.identity-verification-method-create.labels.publicKeyBase64"
			),
			publicKeyBase64
		);

		CLIDisplay.value(
			I18n.formatMessage(
				"node.cli.commands.identity-verification-method-create.labels.privateKeyHex"
			),
			privateKeyHex
		);
		CLIDisplay.value(
			I18n.formatMessage(
				"node.cli.commands.identity-verification-method-create.labels.publicKeyHex"
			),
			publicKeyHex
		);

		CLIDisplay.break();

		json = {
			verificationMethodId: verificationMethod.id,
			verificationMethodType: verificationMethod.type,
			privateKeyJwk: {
				kid,
				...jwk
			},
			privateKeyHex,
			publicKeyHex,
			privateKeyBase64,
			publicKeyBase64
		};

		if (Is.stringValue(params.outputJson)) {
			await CLIUtils.writeJsonFile(params.outputJson, json, false);
		}

		if (Is.stringValue(params.outputEnv)) {
			const output = [
				`${params.outputEnvPrefix}DID_VERIFICATION_METHOD_ID="${verificationMethod.id}"`,
				`${params.outputEnvPrefix}DID_VERIFICATION_METHOD_TYPE="${verificationMethod.type}"`,
				`${params.outputEnvPrefix}DID_VERIFICATION_METHOD_JWK_KID="${kid}"`,
				`${params.outputEnvPrefix}DID_VERIFICATION_METHOD_JWK_KTY="${jwk.kty}"`,
				`${params.outputEnvPrefix}DID_VERIFICATION_METHOD_JWK_USE="${jwk.use}"`,
				`${params.outputEnvPrefix}DID_VERIFICATION_METHOD_JWK_ALG="${jwk.alg}"`,
				`${params.outputEnvPrefix}DID_VERIFICATION_METHOD_JWK_CRV="${jwk.crv}"`,
				`${params.outputEnvPrefix}DID_VERIFICATION_METHOD_JWK_X="${jwk.x}"`,
				`${params.outputEnvPrefix}DID_VERIFICATION_METHOD_JWK_D="${jwk.d}"`,
				`${params.outputEnvPrefix}DID_VERIFICATION_METHOD_PRIVATE_KEY_HEX="${privateKeyHex}"`,
				`${params.outputEnvPrefix}DID_VERIFICATION_METHOD_PUBLIC_KEY_HEX="${publicKeyHex}"`,
				`${params.outputEnvPrefix}DID_VERIFICATION_METHOD_PRIVATE_KEY_BASE64="${privateKeyBase64}"`,
				`${params.outputEnvPrefix}DID_VERIFICATION_METHOD_PUBLIC_KEY_BASE64="${publicKeyBase64}"`
			];
			await CLIUtils.writeEnvFile(params.outputEnv, output, false);
		}
	}

	CLIDisplay.done();

	return json;
}
