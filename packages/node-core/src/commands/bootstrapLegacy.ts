// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { CLIDisplay } from "@twin.org/cli-core";
import { ContextIdKeys, ContextIdStore } from "@twin.org/context";
import { Coerce, Converter, GeneralError, I18n, Is } from "@twin.org/core";
import type { IEngineCore } from "@twin.org/engine-models";
import { identityCreate } from "./identityCreate.js";
import { identityVerificationMethodCreate } from "./identityVerificationMethodCreate.js";
import { nodeSetIdentity } from "./nodeSetIdentity.js";
import { nodeSetTenant } from "./nodeSetTenant.js";
import { tenantCreate } from "./tenantCreate.js";
import { userCreate } from "./userCreate.js";
import { vaultKeyCreate } from "./vaultKeyCreate.js";
import { vaultKeyImport } from "./vaultKeyImport.js";
import { isTrustRequired, isUrlTransformerRequired } from "../builders/engineEnvBuilder.js";
import type { ICliCommandDefinition } from "../models/ICliCommandDefinition.js";
import type { INodeEngineConfig } from "../models/INodeEngineConfig.js";
import type { INodeEngineState } from "../models/INodeEngineState.js";
import type { INodeEnvironmentVariables } from "../models/INodeEnvironmentVariables.js";

const COMMAND_NAME = "bootstrap-legacy";

/**
 * Get the command definition parameters.
 * @param commandDefinitions The registered command definitions.
 */
export function getCommandDefinitionBootstrapLegacy(commandDefinitions: {
	[id: string]: ICliCommandDefinition;
}): void {
	commandDefinitions[COMMAND_NAME] = {
		command: COMMAND_NAME,
		description: I18n.formatMessage("node.cli.commands.bootstrap-legacy.description"),
		example: I18n.formatMessage("node.cli.commands.bootstrap-legacy.example"),
		requiresNodeIdentity: false,
		requiresTenantId: false,
		params: [
			{
				key: "env-prefix",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.bootstrap-legacy.params.env-prefix.description"
				),
				required: false
			},
			{
				key: "load-env",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.bootstrap-legacy.params.load-env.description"
				),
				required: false
			}
		],
		action: async (engineCore, envVars, params) => bootstrapLegacy(engineCore, envVars, params)
	};
}

/**
 * Command for legacy bootstrap.
 * @param engineCore The engine core.
 * @param envVars The environment variables for the node.
 * @param params The parameters for the command.
 */
export async function bootstrapLegacy(
	engineCore: IEngineCore<INodeEngineConfig, INodeEngineState>,
	envVars: INodeEnvironmentVariables & {
		/**
		 * The features that are enabled on the node.
		 * @default []
		 */
		features?: string;

		/**
		 * The identity of the node which, if empty and node-identity feature is enabled it will be generated.
		 */
		nodeIdentity?: string;

		/**
		 * The mnemonic for the identity, if empty and node-identity feature is enabled it will be randomly generated.
		 */
		nodeMnemonic?: string;

		/**
		 * A tenant id to use as a default for the node.
		 */
		tenantId?: string;

		/**
		 * A tenant api key to use as a default for the node.
		 */
		tenantApiKey?: string;

		/**
		 * If the node-admin-user feature is enabled, this will be the organization of the user, if one is not provided it will be generated
		 */
		organizationIdentity?: string;

		/**
		 * The mnemonic for the organization, if empty and node-admin-user feature is enabled it will be randomly generated.
		 */
		organizationMnemonic?: string;

		/**
		 * If the node-admin-user feature is enabled, this will be the identity of the user, if one is not provided it will be generated
		 */
		adminUserIdentity?: string;

		/**
		 * The mnemonic for the admin user, if empty and node-admin-user feature is enabled it will be randomly generated.
		 */
		adminUserMnemonic?: string;

		/**
		 * If the node-admin-user feature is enabled, this will be the name of the user.
		 * @default admin@node
		 */
		adminUserName?: string;

		/**
		 * If the node-admin-user feature is enabled, this will be the password of the user, if empty it will be randomly generated.
		 */
		adminUserPassword?: string;
	},
	params: {}
): Promise<void> {
	const features = (envVars.features ?? "")
		.split(",")
		.map(f => f.trim())
		.filter(f => f.length > 0);

	const state = engineCore.getState();
	const requireWallet = features.includes("node-wallet");
	let tenantId = state.nodeTenantId;
	let nodeId = state.nodeId;

	if (features.length === 0) {
		throw new GeneralError("bootstrapLegacy", "noFeaturesEnabled");
	}

	if (features.includes("node-identity") && Is.empty(nodeId)) {
		CLIDisplay.break();
		CLIDisplay.section(
			I18n.formatMessage("node.cli.commands.bootstrap-legacy.labels.nodeIdentityCreate")
		);

		const nodeIdentity = await identityCreate(engineCore, envVars, {
			identity: envVars.nodeIdentity,
			mnemonic: envVars.nodeMnemonic,
			fundWallet: requireWallet
		});

		nodeId = nodeIdentity.did;

		CLIDisplay.break();
		CLIDisplay.section(
			I18n.formatMessage("node.cli.commands.bootstrap-legacy.labels.nodeAuthKeyCreate")
		);
		await vaultKeyCreate(engineCore, envVars, {
			identity: nodeIdentity.did,
			keyType: "Ed25519",
			keyId: envVars.authSigningKeyId,
			overwriteMode: "skip"
		});

		if (isTrustRequired(envVars)) {
			CLIDisplay.break();
			CLIDisplay.section(
				I18n.formatMessage(
					"node.cli.commands.bootstrap-legacy.labels.trustVerificationMethodCreate"
				)
			);

			await identityVerificationMethodCreate(engineCore, envVars, {
				identity: nodeIdentity.did,
				verificationMethodType: "assertionMethod",
				verificationMethodId: envVars.trustVerificationMethodId,
				overwriteMode: "skip"
			});
		}

		if (
			(Coerce.boolean(envVars.synchronisedStorageEnabled) ?? false) &&
			Is.stringBase64(envVars.synchronisedStorageBlobStorageKey)
		) {
			CLIDisplay.break();
			CLIDisplay.section(
				I18n.formatMessage("node.cli.commands.bootstrap-legacy.labels.synchronisedStorageKeyAdd")
			);
			await vaultKeyImport(engineCore, envVars, {
				identity: nodeIdentity.did,
				keyType: "ChaCha20Poly1305",
				keyId: envVars.synchronisedStorageBlobStorageEncryptionKeyId,
				privateKeyHex: Converter.bytesToHex(
					Converter.base64ToBytes(envVars.synchronisedStorageBlobStorageKey)
				)
			});
		}

		if (isUrlTransformerRequired(envVars)) {
			CLIDisplay.break();
			CLIDisplay.section(
				I18n.formatMessage("node.cli.commands.bootstrap-legacy.labels.urlTransformParamKeyAdd")
			);
			await vaultKeyCreate(engineCore, envVars, {
				identity: nodeIdentity.did,
				keyType: "ChaCha20Poly1305",
				keyId: envVars.urlTransformerEncryptionKeyId
			});
		}

		CLIDisplay.break();
		CLIDisplay.section(
			I18n.formatMessage("node.cli.commands.bootstrap-legacy.labels.nodeIdentitySet")
		);
		await nodeSetIdentity(engineCore, envVars, {
			identity: nodeId
		});

		const tenantEnabled = Coerce.boolean(envVars.tenantEnabled) ?? false;
		if (tenantEnabled) {
			if (Is.empty(tenantId)) {
				await ContextIdStore.run({ [ContextIdKeys.Node]: nodeId }, async () => {
					CLIDisplay.break();
					CLIDisplay.section(
						I18n.formatMessage("node.cli.commands.bootstrap-legacy.labels.nodeTenantCreate")
					);
					const tenantDetails = await tenantCreate(engineCore, envVars, {
						tenantId: envVars.tenantId,
						apiKey: envVars.tenantApiKey,
						label: "Node"
					});

					CLIDisplay.break();
					CLIDisplay.section(
						I18n.formatMessage("node.cli.commands.bootstrap-legacy.labels.nodeTenantSet")
					);
					await nodeSetTenant(engineCore, envVars, {
						tenantId: tenantDetails.tenantId
					});

					tenantId = tenantDetails.tenantId;
				});
			}
		}
	}

	if (features.includes("node-admin-user")) {
		await ContextIdStore.run(
			{ [ContextIdKeys.Node]: nodeId, [ContextIdKeys.Tenant]: tenantId },
			async () => {
				CLIDisplay.break();
				CLIDisplay.section(
					I18n.formatMessage("node.cli.commands.bootstrap-legacy.labels.organisationCreate")
				);
				const organisation = await identityCreate(engineCore, envVars, {
					identity: envVars.organizationIdentity,
					mnemonic: envVars.organizationMnemonic,
					fundWallet: requireWallet
				});

				if (Coerce.boolean(envVars.blobStorageEnableEncryption) ?? false) {
					CLIDisplay.break();
					CLIDisplay.section(
						I18n.formatMessage("node.cli.commands.bootstrap-legacy.labels.blobStorageKeyCreate")
					);
					await vaultKeyCreate(engineCore, envVars, {
						identity: organisation.did,
						keyType: "ChaCha20Poly1305",
						keyId: envVars.blobStorageEncryptionKeyId,
						overwriteMode: "skip"
					});
				}

				const defaultAttestationConnectorType =
					engineCore.getRegisteredInstanceTypeOptional("attestationConnector");
				if (!Is.empty(defaultAttestationConnectorType)) {
					CLIDisplay.break();
					CLIDisplay.section(
						I18n.formatMessage("node.cli.commands.bootstrap-legacy.labels.attestationMethodCreate")
					);
					await identityVerificationMethodCreate(engineCore, envVars, {
						identity: organisation.did,
						verificationMethodType: "assertionMethod",
						verificationMethodId: envVars.attestationVerificationMethodId,
						overwriteMode: "skip"
					});
				}

				const defaultImmutableProofComponentType =
					engineCore.getRegisteredInstanceTypeOptional("immutableProofComponent");

				if (!Is.empty(defaultImmutableProofComponentType)) {
					CLIDisplay.break();
					CLIDisplay.section(
						I18n.formatMessage(
							"node.cli.commands.bootstrap-legacy.labels.immutableProofMethodCreate"
						)
					);
					await identityVerificationMethodCreate(engineCore, envVars, {
						identity: organisation.did,
						verificationMethodType: "assertionMethod",
						verificationMethodId: envVars.immutableProofVerificationMethodId,
						overwriteMode: "skip"
					});
				}

				CLIDisplay.break();
				CLIDisplay.section(
					I18n.formatMessage("node.cli.commands.bootstrap-legacy.labels.adminIdentityCreate")
				);
				const adminUserIdentity = await identityCreate(engineCore, envVars, {
					identity: envVars.adminUserIdentity,
					mnemonic: envVars.adminUserMnemonic,
					controller: organisation.did
				});

				CLIDisplay.break();
				CLIDisplay.section(
					I18n.formatMessage("node.cli.commands.bootstrap-legacy.labels.adminUserCreate")
				);
				await userCreate(engineCore, envVars, {
					userIdentity: adminUserIdentity.did,
					organizationIdentity: organisation.did,
					tenantId,
					email: envVars.adminUserName ?? "admin@node",
					password: envVars.adminUserPassword,
					scope: ["tenant-admin", "user-admin"].join(","),
					givenName: "Node",
					familyName: "Admin",
					overwriteMode: "skip"
				});
			}
		);
	}
}
