// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { CLIDisplay, CLIUtils } from "@twin.org/cli-core";
import { Converter, GeneralError, Guards, I18n, Is } from "@twin.org/core";
import type { IEngineCore } from "@twin.org/engine-models";
import { Did } from "@twin.org/identity-models";
import { VaultConnectorFactory, VaultKeyType } from "@twin.org/vault-models";
import type { ICliCommandDefinition } from "../models/ICliCommandDefinition.js";
import type { IEnvironmentVariables } from "../models/IEnvironmentVariables.js";
import type { INodeEngineConfig } from "../models/INodeEngineConfig.js";
import type { INodeEngineState } from "../models/INodeEngineState.js";

const COMMAND_NAME = "vault-key-create";

/**
 * Get the command definition parameters.
 * @param commandDefinitions The registered command definitions.
 */
export function getCommandDefinitionVaultKeyCreate(commandDefinitions: {
	[id: string]: ICliCommandDefinition;
}): void {
	commandDefinitions[COMMAND_NAME] = {
		command: COMMAND_NAME,
		description: I18n.formatMessage("node.cli.commands.vault-key-create.description"),
		example: I18n.formatMessage("node.cli.commands.vault-key-create.example"),
		requiresNodeIdentity: false,
		requiresOrgIdentity: false,
		params: [
			{
				key: "env-prefix",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.vault-key-create.params.env-prefix.description"
				),
				required: false
			},
			{
				key: "identity",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.vault-key-create.params.identity.description"
				),
				extendedType: "did",
				required: true
			},
			{
				key: "key-id",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.vault-key-create.params.key-id.description"
				),
				required: true
			},
			{
				key: "key-type",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.vault-key-create.params.key-type.description"
				),
				options: ["Ed25519", "Secp256k1", "ChaCha20Poly1305"],
				defaultValue: "Ed25519",
				required: false
			},
			{
				key: "overwrite-mode",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.vault-key-create.params.overwrite-mode.description"
				),
				options: ["skip", "overwrite", "error"],
				defaultValue: "skip",
				required: false
			},
			{
				key: "load-env",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.vault-key-create.params.load-env.description"
				),
				required: false
			},
			{
				key: "output-json",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.vault-key-create.params.output-json.description"
				),
				required: false
			},
			{
				key: "output-env",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.vault-key-create.params.output-env.description"
				),
				required: false
			},
			{
				key: "output-env-prefix",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.vault-key-create.params.output-env-prefix.description"
				),
				required: false
			}
		],
		action: async (engineCore, envVars, params) => vaultKeyCreate(engineCore, envVars, params)
	};
}

/**
 * Command for creating a vault key.
 * @param engineCore The engine core.
 * @param envVars The environment variables for the node.
 * @param params The parameters for the command.
 * @param params.identity The DID to create the vault key for.
 * @param params.keyId The ID of the key to create.
 * @param params.keyType The type of key to create.
 * @param params.overwriteMode The mode to use when a user with the same identity already exists.
 * @param params.outputJson The output .json file to store the command output.
 * @param params.outputEnv The output .env file to store the command output.
 * @param params.outputEnvPrefix The prefix to use for variables in the output .env file.
 * @returns The created vault key details or undefined if skipped.
 */
export async function vaultKeyCreate(
	engineCore: IEngineCore<INodeEngineConfig, INodeEngineState>,
	envVars: IEnvironmentVariables,
	params: {
		identity?: string;
		keyType?: string;
		keyId?: string;
		overwriteMode?: "skip" | "overwrite" | "error";
		outputJson?: string;
		outputEnv?: string;
		outputEnvPrefix?: string;
	}
): Promise<
	| {
			identity: string;
			keyId: string;
			keyType?: string;
			privateKeyBase64?: string;
			publicKeyBase64?: string;
			privateKeyHex?: string;
			publicKeyHex?: string;
	  }
	| undefined
> {
	Did.guard("vaultKeyCreate", "identity", params.identity);
	Guards.stringValue("vaultKeyCreate", "key-id", params.keyId);
	Guards.arrayOneOf("vaultKeyCreate", "key-type", params.keyType, [
		"Ed25519",
		"Secp256k1",
		"ChaCha20Poly1305"
	]);

	const defaultVaultConnectorType = engineCore.getRegisteredInstanceType("vaultConnector");
	const vaultConnector = VaultConnectorFactory.get(defaultVaultConnectorType);

	let createVaultKey = true;
	const fullKeyId = `${params.identity}/${params.keyId}`;

	let existingKey;
	try {
		existingKey = await vaultConnector.getKey(fullKeyId);
	} catch {}

	if (Is.notEmpty(existingKey)) {
		if (params.overwriteMode === "error") {
			throw new GeneralError("vaultKeyCreate", "vaultKeyAlreadyExists");
		} else if (params.overwriteMode === "skip") {
			createVaultKey = false;
			CLIDisplay.task(I18n.formatMessage("node.cli.commands.vault-key-create.labels.skipping"));
		} else if (params.overwriteMode === "overwrite") {
			CLIDisplay.task(I18n.formatMessage("node.cli.commands.vault-key-create.labels.overwriting"));
			await vaultConnector.removeKey(fullKeyId);
		}
	}

	let json;
	if (createVaultKey) {
		CLIDisplay.task(I18n.formatMessage("node.cli.commands.vault-key-create.labels.creating"));
		CLIDisplay.spinnerStart();

		await vaultConnector.createKey(
			fullKeyId,
			VaultKeyType[params.keyType as keyof typeof VaultKeyType]
		);

		const key = await vaultConnector.getKey(fullKeyId);

		CLIDisplay.spinnerStop();
		CLIDisplay.task(I18n.formatMessage("node.cli.commands.vault-key-create.labels.created"));

		const privateKeyBase64 = key.privateKey ? Converter.bytesToBase64(key.privateKey) : undefined;
		const publicKeyBase64 = key.publicKey ? Converter.bytesToBase64(key.publicKey) : undefined;
		const privateKeyHex = key.privateKey ? Converter.bytesToHex(key.privateKey, true) : undefined;
		const publicKeyHex = key.publicKey ? Converter.bytesToHex(key.publicKey, true) : undefined;

		CLIDisplay.break();
		CLIDisplay.value(
			I18n.formatMessage("node.cli.commands.vault-key-create.labels.keyId"),
			params.keyId
		);
		CLIDisplay.value(
			I18n.formatMessage("node.cli.commands.vault-key-create.labels.keyType"),
			params.keyType
		);
		if (Is.stringValue(privateKeyBase64)) {
			CLIDisplay.value(
				I18n.formatMessage("node.cli.commands.vault-key-create.labels.privateKeyBase64"),
				privateKeyBase64
			);
		}
		if (Is.stringValue(publicKeyBase64)) {
			CLIDisplay.value(
				I18n.formatMessage("node.cli.commands.vault-key-create.labels.publicKeyBase64"),
				publicKeyBase64
			);
		}
		if (Is.stringValue(privateKeyHex)) {
			CLIDisplay.value(
				I18n.formatMessage("node.cli.commands.vault-key-create.labels.privateKeyHex"),
				privateKeyHex
			);
		}
		if (Is.stringValue(publicKeyHex)) {
			CLIDisplay.value(
				I18n.formatMessage("node.cli.commands.vault-key-create.labels.publicKeyHex"),
				publicKeyHex
			);
		}

		CLIDisplay.break();

		json = {
			identity: params.identity,
			keyId: params.keyId,
			keyType: params.keyType,
			privateKeyBase64,
			publicKeyBase64,
			privateKeyHex,
			publicKeyHex
		};
		if (Is.stringValue(params.outputJson)) {
			await CLIUtils.writeJsonFile(params.outputJson, json, false);
		}

		if (Is.stringValue(params.outputEnv)) {
			const outputParams = [
				`${params.outputEnvPrefix}IDENTITY="${params.identity}"`,
				`${params.outputEnvPrefix}KEY_ID="${params.keyId}"`,
				`${params.outputEnvPrefix}KEY_TYPE="${params.keyType}"`
			];

			if (Is.stringValue(privateKeyBase64)) {
				outputParams.push(`${params.outputEnvPrefix}PRIVATE_KEY_BASE64="${privateKeyBase64}"`);
			}

			if (Is.stringValue(publicKeyBase64)) {
				outputParams.push(`${params.outputEnvPrefix}PUBLIC_KEY_BASE64="${publicKeyBase64}"`);
			}
			if (Is.stringValue(privateKeyHex)) {
				outputParams.push(`${params.outputEnvPrefix}PRIVATE_KEY_HEX="${privateKeyHex}"`);
			}
			if (Is.stringValue(publicKeyHex)) {
				outputParams.push(`${params.outputEnvPrefix}PUBLIC_KEY_HEX="${publicKeyHex}"`);
			}
			await CLIUtils.writeEnvFile(params.outputEnv, outputParams, false);
		}
	}

	CLIDisplay.done();

	return json;
}
