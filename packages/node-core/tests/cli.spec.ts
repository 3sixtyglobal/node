// Copyright 2025 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFile, rm, writeFile } from "node:fs/promises";
import { CLIUtils } from "@twin.org/cli-core";
import { Converter, Factory } from "@twin.org/core";
import { MemoryStateStorage } from "@twin.org/engine-core";
import { AuthenticationAdminComponentType } from "@twin.org/engine-server-types";
import {
	EntityStorageConnectorType,
	FaucetConnectorType,
	IdentityConnectorType,
	IdentityProfileConnectorType,
	IdentityResolverConnectorType,
	VaultConnectorType,
	WalletConnectorType
} from "@twin.org/engine-types";
import type { INodeEngineState } from "../src/models/INodeEngineState.js";
import { run } from "../src/node.js";

const basePort = Math.floor(Math.random() * 1000);
let port = 3000 + basePort;
const OUTPUT_TMP_DIR = "./tests/.tmp/";

/**
 * Get the value from an env line.
 * @param line The env line.
 * @returns The value.
 */
function valueFromEnv(line?: string): string | undefined {
	return line?.split("=").slice(1).join("=").replace(/"/g, "");
}

/**
 * Execute a CLI command.
 * @param args The CLI args.
 * @param state The initial state.
 * @param additionalEnvVars Additional environment variables to set.
 * @returns The state storage.
 */
async function executeCliCommand(
	args: string[],
	state: INodeEngineState,
	additionalEnvVars?: { [key: string]: string }
): Promise<INodeEngineState> {
	const stateStorage = new MemoryStateStorage(false, state);
	await run(
		{
			localesDirectory: "./dist/locales/",
			stateStorage,
			envVars: {
				TWIN_DEBUG: "true",
				TWIN_SILENT: "true",
				TWIN_TENANT_ENABLED: "true",
				TWIN_PORT: port.toString(),
				TWIN_STORAGE_FILE_ROOT: `${OUTPUT_TMP_DIR}db`,
				TWIN_ENTITY_STORAGE_CONNECTOR_TYPE: EntityStorageConnectorType.File,
				TWIN_VAULT_CONNECTOR: VaultConnectorType.EntityStorage,
				TWIN_IDENTITY_CONNECTOR: IdentityConnectorType.EntityStorage,
				TWIN_IDENTITY_RESOLVER_CONNECTOR: IdentityResolverConnectorType.EntityStorage,
				TWIN_IDENTITY_PROFILE_CONNECTOR: IdentityProfileConnectorType.EntityStorage,
				TWIN_FAUCET_CONNECTOR: FaucetConnectorType.EntityStorage,
				TWIN_WALLET_CONNECTOR: WalletConnectorType.EntityStorage,
				TWIN_AUTH_ADMIN_PROCESSOR_TYPE: AuthenticationAdminComponentType.EntityStorage,
				TWIN_TASK_SCHEDULER_ENABLED: "true",
				TWIN_URL_TRANSFORMER_ENABLED: "true",
				...additionalEnvVars
			}
		},
		["node", "index.js", ...args]
	);
	return state;
}

let nodeIdentityJson: { mnemonic: string; did: string; walletAddress: string };
let organizationIdentityJson: { mnemonic: string; did: string; walletAddress: string };
let userIdentityJson: { mnemonic: string; did: string; walletAddress: string };
let nodeTenantJson: { apiKey: string; tenantId: string; label: string; publicOrigin: string };

describe("node-core", () => {
	beforeAll(async () => {
		await rm(OUTPUT_TMP_DIR, { recursive: true, force: true });
	});

	beforeEach(() => {
		port++;

		Factory.clearFactories();
	});

	test("Can show the root help", async () => {
		await executeCliCommand(["--help"], {});
	});

	test("Can show the help for a command", async () => {
		await executeCliCommand(["bootstrap-legacy", "--help"], {});
	});

	test("Can bootstrap in legacy mode", async () => {
		await executeCliCommand(
			["bootstrap-legacy"],
			{},
			{
				TWIN_FEATURES: "node-identity,node-wallet,node-admin-user"
			}
		);
	});

	test("Can create the node identity", async () => {
		await executeCliCommand(
			[
				"identity-create",
				"--fund-wallet=true",
				`--output-json=${OUTPUT_TMP_DIR}node-identity.json`,
				`--output-env=${OUTPUT_TMP_DIR}node-identity.env`,
				"--output-env-prefix=node"
			],
			{}
		);

		nodeIdentityJson = await CLIUtils.readJsonFile<any>(`${OUTPUT_TMP_DIR}node-identity.json`);
		const nodeIdentityEnv = await CLIUtils.readLinesFile(`${OUTPUT_TMP_DIR}node-identity.env`);
		expect(nodeIdentityJson?.mnemonic).toEqual(valueFromEnv(nodeIdentityEnv?.[0]));
		expect(nodeIdentityJson?.did).toEqual(valueFromEnv(nodeIdentityEnv?.[1]));
		expect(nodeIdentityJson?.walletAddress).toEqual(valueFromEnv(nodeIdentityEnv?.[2]));
	});

	test("Can import an identity", async () => {
		await executeCliCommand(
			[
				"identity-import",
				`--identity=${nodeIdentityJson?.did}`,
				`--mnemonic=${nodeIdentityJson?.mnemonic}`
			],
			{}
		);
	});

	test("Can set the node identity", async () => {
		const nodeState = await executeCliCommand(
			[
				"node-set-identity",
				`--load-env=${OUTPUT_TMP_DIR}node-identity.env`,
				"--identity=!NODE_DID"
			],
			{}
		);
		expect(nodeState).toEqual({ nodeId: nodeIdentityJson?.did });
	});

	test("Can create the node auth key", async () => {
		await executeCliCommand(
			[
				"vault-key-create",
				`--load-env=${OUTPUT_TMP_DIR}node-identity.env`,
				"--identity=!NODE_DID",
				"--key-id=!TWIN_AUTH_SIGNING_KEY_ID",
				`--output-json=${OUTPUT_TMP_DIR}node-auth-key.json`,
				`--output-env=${OUTPUT_TMP_DIR}node-auth-key.env`
			],
			{ nodeId: nodeIdentityJson?.did }
		);

		const nodeAuthKeyJson = await CLIUtils.readJsonFile<any>(`${OUTPUT_TMP_DIR}node-auth-key.json`);
		const nodeAuthKeyEnv = await CLIUtils.readLinesFile(`${OUTPUT_TMP_DIR}node-auth-key.env`);
		expect(nodeAuthKeyJson?.identity).toEqual(nodeIdentityJson?.did);
		expect(nodeAuthKeyJson?.identity).toEqual(valueFromEnv(nodeAuthKeyEnv?.[0]));
		expect(nodeAuthKeyJson?.keyId).toEqual(valueFromEnv(nodeAuthKeyEnv?.[1]));
		expect(nodeAuthKeyJson?.keyType).toEqual(valueFromEnv(nodeAuthKeyEnv?.[2]));
		expect(nodeAuthKeyJson?.privateKeyBase64).toEqual(valueFromEnv(nodeAuthKeyEnv?.[3]));
		expect(nodeAuthKeyJson?.publicKeyBase64).toEqual(valueFromEnv(nodeAuthKeyEnv?.[4]));
		expect(nodeAuthKeyJson?.privateKeyHex).toEqual(valueFromEnv(nodeAuthKeyEnv?.[5]));
		expect(nodeAuthKeyJson?.publicKeyHex).toEqual(valueFromEnv(nodeAuthKeyEnv?.[6]));
	});

	test("Can import the node auth key", async () => {
		const nodeAuthKeyJson = await CLIUtils.readJsonFile<any>(`${OUTPUT_TMP_DIR}node-auth-key.json`);

		await executeCliCommand(
			[
				"vault-key-import",
				`--identity=${nodeIdentityJson.did}`,
				"--key-id=!TWIN_AUTH_SIGNING_KEY_ID",
				`--key-type=${nodeAuthKeyJson?.keyType}`,
				`--private-key-hex=${nodeAuthKeyJson?.privateKeyHex}`
			],
			{ nodeId: nodeIdentityJson?.did }
		);
	});

	test("Can create the node synchronised storage encryption key", async () => {
		await executeCliCommand(
			[
				"vault-key-create",
				`--load-env=${OUTPUT_TMP_DIR}node-identity.env`,
				"--identity=!NODE_DID",
				"--key-id=!TWIN_SYNCHRONISED_STORAGE_BLOB_STORAGE_ENCRYPTION_KEY_ID",
				"--key-type=ChaCha20Poly1305",
				`--output-json=${OUTPUT_TMP_DIR}node-synchronised-storage-encryption-key.json`,
				`--output-env=${OUTPUT_TMP_DIR}node-synchronised-storage-encryption-key.env`
			],
			{ nodeId: nodeIdentityJson?.did }
		);

		const nodeSynchronisedStorageBlobEncryptionJson = await CLIUtils.readJsonFile<any>(
			`${OUTPUT_TMP_DIR}node-synchronised-storage-encryption-key.json`
		);
		const nodeSynchronisedStorageBlobEncryptionEnv = await CLIUtils.readLinesFile(
			`${OUTPUT_TMP_DIR}node-synchronised-storage-encryption-key.env`
		);
		expect(nodeSynchronisedStorageBlobEncryptionJson?.identity).toEqual(nodeIdentityJson?.did);
		expect(nodeSynchronisedStorageBlobEncryptionJson?.identity).toEqual(
			valueFromEnv(nodeSynchronisedStorageBlobEncryptionEnv?.[0])
		);
		expect(nodeSynchronisedStorageBlobEncryptionJson?.keyId).toEqual(
			valueFromEnv(nodeSynchronisedStorageBlobEncryptionEnv?.[1])
		);
		expect(nodeSynchronisedStorageBlobEncryptionJson?.keyType).toEqual(
			valueFromEnv(nodeSynchronisedStorageBlobEncryptionEnv?.[2])
		);
		expect(nodeSynchronisedStorageBlobEncryptionJson?.privateKeyBase64).toEqual(
			valueFromEnv(nodeSynchronisedStorageBlobEncryptionEnv?.[3])
		);
		expect(nodeSynchronisedStorageBlobEncryptionJson?.privateKeyHex).toEqual(
			valueFromEnv(nodeSynchronisedStorageBlobEncryptionEnv?.[4])
		);
	});

	test("Can create the tenant for the node", async () => {
		await executeCliCommand(
			[
				"tenant-create",
				`--output-json=${OUTPUT_TMP_DIR}node-tenant.json`,
				`--output-env=${OUTPUT_TMP_DIR}node-tenant.env`,
				"--label=node",
				"--public-origin=https://api.example.com:1234",
				"--output-env-prefix=node"
			],
			{ nodeId: nodeIdentityJson?.did }
		);

		nodeTenantJson = await CLIUtils.readJsonFile<any>(`${OUTPUT_TMP_DIR}node-tenant.json`);
		const nodeTenantEnv = await CLIUtils.readLinesFile(`${OUTPUT_TMP_DIR}node-tenant.env`);
		expect(nodeTenantJson?.apiKey).toEqual(valueFromEnv(nodeTenantEnv?.[0]));
		expect(nodeTenantJson?.tenantId).toEqual(valueFromEnv(nodeTenantEnv?.[1]));
		expect(nodeTenantJson?.label).toEqual(valueFromEnv(nodeTenantEnv?.[2]));
		expect(nodeTenantJson?.publicOrigin).toEqual(valueFromEnv(nodeTenantEnv?.[3]));

		const dbTable = await CLIUtils.readJsonFile<any>(`${OUTPUT_TMP_DIR}db/tenant/store.json`);
		expect(dbTable?.[1]?.label).toEqual("node");
		expect(dbTable?.[1]?.publicOrigin).toEqual("https://api.example.com:1234");

		const nodeIdParts = nodeIdentityJson?.did.split(":");
		const partitionId = Converter.bytesToBase64Url(Converter.hexToBytes(nodeIdParts[2]));
		expect(dbTable?.[1]?.partitionId).toEqual(partitionId);
	});

	test("Can import the tenant for the node", async () => {
		await executeCliCommand(
			[
				"tenant-import",
				`--tenant-id=${nodeTenantJson?.tenantId}`,
				`--api-key=${nodeTenantJson?.apiKey}`,
				`--label=${nodeTenantJson?.label}`,
				`--public-origin=${nodeTenantJson?.publicOrigin}`
			],
			{ nodeId: nodeIdentityJson?.did }
		);
	});

	test("Can set the node tenant", async () => {
		const nodeState = await executeCliCommand(
			[
				"node-set-tenant",
				`--load-env=${OUTPUT_TMP_DIR}node-tenant.env`,
				"--tenant-id=!NODE_TENANT_ID"
			],
			{ nodeId: nodeIdentityJson?.did }
		);
		expect(nodeState.nodeTenantId).toEqual(nodeTenantJson?.tenantId);
	});

	test("Can create the organization identity", async () => {
		await executeCliCommand(
			[
				"identity-create",
				`--load-env=${OUTPUT_TMP_DIR}node-identity.env`,
				"--fund-wallet=true",
				"--controller=!NODE_DID",
				`--output-json=${OUTPUT_TMP_DIR}organization-identity.json`,
				`--output-env=${OUTPUT_TMP_DIR}organization-identity.env`,
				"--output-env-prefix=organization"
			],
			{}
		);

		organizationIdentityJson = await CLIUtils.readJsonFile<any>(
			`${OUTPUT_TMP_DIR}organization-identity.json`
		);
		const organizationIdentityEnv = await CLIUtils.readLinesFile(
			`${OUTPUT_TMP_DIR}organization-identity.env`
		);
		expect(organizationIdentityJson?.mnemonic).toEqual(valueFromEnv(organizationIdentityEnv?.[0]));
		expect(organizationIdentityJson?.did).toEqual(valueFromEnv(organizationIdentityEnv?.[1]));
		expect(organizationIdentityJson?.walletAddress).toEqual(
			valueFromEnv(organizationIdentityEnv?.[2])
		);
	});

	test("Can create the organization attestation verification method", async () => {
		await executeCliCommand(
			[
				"identity-verification-method-create",
				`--load-env=${OUTPUT_TMP_DIR}node-identity.env,${OUTPUT_TMP_DIR}organization-identity.env`,
				"--identity=!ORGANIZATION_DID",
				"--controller=!NODE_DID",
				"--verification-method-id=!TWIN_ATTESTATION_VERIFICATION_METHOD_ID",
				`--output-json=${OUTPUT_TMP_DIR}organization-attestation.json`,
				`--output-env=${OUTPUT_TMP_DIR}organization-attestation.env`
			],
			{}
		);

		const organizationAttestationJson = await CLIUtils.readJsonFile<any>(
			`${OUTPUT_TMP_DIR}organization-attestation.json`
		);
		const organizationAttestationEnv = await CLIUtils.readLinesFile(
			`${OUTPUT_TMP_DIR}organization-attestation.env`
		);
		expect(organizationAttestationJson?.verificationMethodId).toEqual(
			`${organizationIdentityJson.did}#attestation-assertion`
		);
		expect(organizationAttestationJson?.verificationMethodId).toEqual(
			valueFromEnv(organizationAttestationEnv?.[0])
		);
		expect(organizationAttestationJson?.verificationMethodType).toEqual(
			valueFromEnv(organizationAttestationEnv?.[1])
		);
		expect(organizationAttestationJson?.privateKeyJwk?.kid).toEqual(
			valueFromEnv(organizationAttestationEnv?.[2])
		);
		expect(organizationAttestationJson?.privateKeyJwk?.kty).toEqual(
			valueFromEnv(organizationAttestationEnv?.[3])
		);
		expect(organizationAttestationJson?.privateKeyJwk?.use).toEqual(
			valueFromEnv(organizationAttestationEnv?.[4])
		);
		expect(organizationAttestationJson?.privateKeyJwk?.alg).toEqual(
			valueFromEnv(organizationAttestationEnv?.[5])
		);
		expect(organizationAttestationJson?.privateKeyJwk?.crv).toEqual(
			valueFromEnv(organizationAttestationEnv?.[6])
		);
		expect(organizationAttestationJson?.privateKeyJwk?.x).toEqual(
			valueFromEnv(organizationAttestationEnv?.[7])
		);
		expect(organizationAttestationJson?.privateKeyJwk?.d).toEqual(
			valueFromEnv(organizationAttestationEnv?.[8])
		);
		expect(organizationAttestationJson?.privateKeyHex).toEqual(
			valueFromEnv(organizationAttestationEnv?.[9])
		);
		expect(organizationAttestationJson?.publicKeyHex).toEqual(
			valueFromEnv(organizationAttestationEnv?.[10])
		);
		expect(organizationAttestationJson?.privateKeyBase64).toEqual(
			valueFromEnv(organizationAttestationEnv?.[11])
		);
		expect(organizationAttestationJson?.publicKeyBase64).toEqual(
			valueFromEnv(organizationAttestationEnv?.[12])
		);
	});

	test("Can create the organization immutable proof verification method", async () => {
		await executeCliCommand(
			[
				"identity-verification-method-create",
				`--load-env=${OUTPUT_TMP_DIR}node-identity.env,${OUTPUT_TMP_DIR}organization-identity.env`,
				"--identity=!ORGANIZATION_DID",
				"--controller=!NODE_DID",
				"--verification-method-id=!TWIN_IMMUTABLE_PROOF_VERIFICATION_METHOD_ID",
				`--output-json=${OUTPUT_TMP_DIR}organization-immutable-proof.json`,
				`--output-env=${OUTPUT_TMP_DIR}organization-immutable-proof.env`
			],
			{}
		);

		const organizationImmutableProofJson = await CLIUtils.readJsonFile<any>(
			`${OUTPUT_TMP_DIR}organization-immutable-proof.json`
		);
		const organizationImmutableProofEnv = await CLIUtils.readLinesFile(
			`${OUTPUT_TMP_DIR}organization-immutable-proof.env`
		);
		expect(organizationImmutableProofJson?.verificationMethodId).toEqual(
			`${organizationIdentityJson.did}#immutable-proof-assertion`
		);
		expect(organizationImmutableProofJson?.verificationMethodId).toEqual(
			valueFromEnv(organizationImmutableProofEnv?.[0])
		);
		expect(organizationImmutableProofJson?.verificationMethodType).toEqual(
			valueFromEnv(organizationImmutableProofEnv?.[1])
		);
		expect(organizationImmutableProofJson?.privateKeyJwk?.kid).toEqual(
			valueFromEnv(organizationImmutableProofEnv?.[2])
		);
		expect(organizationImmutableProofJson?.privateKeyJwk?.kty).toEqual(
			valueFromEnv(organizationImmutableProofEnv?.[3])
		);
		expect(organizationImmutableProofJson?.privateKeyJwk?.use).toEqual(
			valueFromEnv(organizationImmutableProofEnv?.[4])
		);
		expect(organizationImmutableProofJson?.privateKeyJwk?.alg).toEqual(
			valueFromEnv(organizationImmutableProofEnv?.[5])
		);
		expect(organizationImmutableProofJson?.privateKeyJwk?.crv).toEqual(
			valueFromEnv(organizationImmutableProofEnv?.[6])
		);
		expect(organizationImmutableProofJson?.privateKeyJwk?.x).toEqual(
			valueFromEnv(organizationImmutableProofEnv?.[7])
		);
		expect(organizationImmutableProofJson?.privateKeyJwk?.d).toEqual(
			valueFromEnv(organizationImmutableProofEnv?.[8])
		);
		expect(organizationImmutableProofJson?.privateKeyHex).toEqual(
			valueFromEnv(organizationImmutableProofEnv?.[9])
		);
		expect(organizationImmutableProofJson?.publicKeyHex).toEqual(
			valueFromEnv(organizationImmutableProofEnv?.[10])
		);
		expect(organizationImmutableProofJson?.privateKeyBase64).toEqual(
			valueFromEnv(organizationImmutableProofEnv?.[11])
		);
		expect(organizationImmutableProofJson?.publicKeyBase64).toEqual(
			valueFromEnv(organizationImmutableProofEnv?.[12])
		);
	});

	test("Can create the organization vc authentication verification method", async () => {
		await executeCliCommand(
			[
				"identity-verification-method-create",
				`--load-env=${OUTPUT_TMP_DIR}node-identity.env,${OUTPUT_TMP_DIR}organization-identity.env`,
				"--identity=!ORGANIZATION_DID",
				"--controller=!NODE_DID",
				"--verification-method-id=!TWIN_TRUST_VERIFICATION_METHOD_ID",
				`--output-json=${OUTPUT_TMP_DIR}organization-trust.json`,
				`--output-env=${OUTPUT_TMP_DIR}organization-trust.env`
			],
			{}
		);

		const organizationVcAuthenticationJson = await CLIUtils.readJsonFile<any>(
			`${OUTPUT_TMP_DIR}organization-trust.json`
		);
		const organizationVcAuthenticationEnv = await CLIUtils.readLinesFile(
			`${OUTPUT_TMP_DIR}organization-trust.env`
		);
		expect(organizationVcAuthenticationJson?.verificationMethodId).toEqual(
			`${organizationIdentityJson.did}#trust-assertion`
		);
		expect(organizationVcAuthenticationJson?.verificationMethodId).toEqual(
			valueFromEnv(organizationVcAuthenticationEnv?.[0])
		);
		expect(organizationVcAuthenticationJson?.verificationMethodType).toEqual(
			valueFromEnv(organizationVcAuthenticationEnv?.[1])
		);
		expect(organizationVcAuthenticationJson?.privateKeyJwk?.kid).toEqual(
			valueFromEnv(organizationVcAuthenticationEnv?.[2])
		);
		expect(organizationVcAuthenticationJson?.privateKeyJwk?.kty).toEqual(
			valueFromEnv(organizationVcAuthenticationEnv?.[3])
		);
		expect(organizationVcAuthenticationJson?.privateKeyJwk?.use).toEqual(
			valueFromEnv(organizationVcAuthenticationEnv?.[4])
		);
		expect(organizationVcAuthenticationJson?.privateKeyJwk?.alg).toEqual(
			valueFromEnv(organizationVcAuthenticationEnv?.[5])
		);
		expect(organizationVcAuthenticationJson?.privateKeyJwk?.crv).toEqual(
			valueFromEnv(organizationVcAuthenticationEnv?.[6])
		);
		expect(organizationVcAuthenticationJson?.privateKeyJwk?.x).toEqual(
			valueFromEnv(organizationVcAuthenticationEnv?.[7])
		);
		expect(organizationVcAuthenticationJson?.privateKeyJwk?.d).toEqual(
			valueFromEnv(organizationVcAuthenticationEnv?.[8])
		);
		expect(organizationVcAuthenticationJson?.privateKeyHex).toEqual(
			valueFromEnv(organizationVcAuthenticationEnv?.[9])
		);
		expect(organizationVcAuthenticationJson?.publicKeyHex).toEqual(
			valueFromEnv(organizationVcAuthenticationEnv?.[10])
		);
		expect(organizationVcAuthenticationJson?.privateKeyBase64).toEqual(
			valueFromEnv(organizationVcAuthenticationEnv?.[11])
		);
		expect(organizationVcAuthenticationJson?.publicKeyBase64).toEqual(
			valueFromEnv(organizationVcAuthenticationEnv?.[12])
		);
	});

	test("Can create the organization blob storage encryption key", async () => {
		await executeCliCommand(
			[
				"vault-key-create",
				`--load-env=${OUTPUT_TMP_DIR}organization-identity.env`,
				"--identity=!ORGANIZATION_DID",
				"--key-id=!TWIN_BLOB_STORAGE_ENCRYPTION_KEY_ID",
				"--key-type=ChaCha20Poly1305",
				`--output-json=${OUTPUT_TMP_DIR}organization-blob-encryption.json`,
				`--output-env=${OUTPUT_TMP_DIR}organization-blob-encryption.env`
			],
			{ nodeId: nodeIdentityJson?.did }
		);

		const organizationBlobEncryptionJson = await CLIUtils.readJsonFile<any>(
			`${OUTPUT_TMP_DIR}organization-blob-encryption.json`
		);
		const organizationBlobEncryptionEnv = await CLIUtils.readLinesFile(
			`${OUTPUT_TMP_DIR}organization-blob-encryption.env`
		);
		expect(organizationBlobEncryptionJson?.identity).toEqual(organizationIdentityJson?.did);
		expect(organizationBlobEncryptionJson?.identity).toEqual(
			valueFromEnv(organizationBlobEncryptionEnv?.[0])
		);
		expect(organizationBlobEncryptionJson?.keyId).toEqual(
			valueFromEnv(organizationBlobEncryptionEnv?.[1])
		);
		expect(organizationBlobEncryptionJson?.keyType).toEqual(
			valueFromEnv(organizationBlobEncryptionEnv?.[2])
		);
		expect(organizationBlobEncryptionJson?.privateKeyBase64).toEqual(
			valueFromEnv(organizationBlobEncryptionEnv?.[3])
		);
		expect(organizationBlobEncryptionJson?.privateKeyHex).toEqual(
			valueFromEnv(organizationBlobEncryptionEnv?.[4])
		);
	});

	test("Can create the user identity", async () => {
		await executeCliCommand(
			[
				"identity-create",
				`--load-env=${OUTPUT_TMP_DIR}organization-identity.env`,
				"--controller=!ORGANIZATION_DID",
				`--output-json=${OUTPUT_TMP_DIR}user-identity.json`,
				`--output-env=${OUTPUT_TMP_DIR}user-identity.env`,
				"--output-env-prefix=user"
			],
			{}
		);

		userIdentityJson = await CLIUtils.readJsonFile<any>(`${OUTPUT_TMP_DIR}user-identity.json`);
		const userIdentityEnv = await CLIUtils.readLinesFile(`${OUTPUT_TMP_DIR}user-identity.env`);
		expect(userIdentityJson?.mnemonic).toEqual(valueFromEnv(userIdentityEnv?.[0]));
		expect(userIdentityJson?.did).toEqual(valueFromEnv(userIdentityEnv?.[1]));
		expect(userIdentityJson?.walletAddress).toBeUndefined();
	});

	test("Can create the user account", async () => {
		const envParts = [
			`${OUTPUT_TMP_DIR}organization-identity.env`,
			`${OUTPUT_TMP_DIR}user-identity.env`,
			`${OUTPUT_TMP_DIR}node-tenant.env`
		];
		await executeCliCommand(
			[
				"user-create",
				`--load-env=${envParts.join(",")}`,
				"--user-identity=!USER_DID",
				"--organization-identity=!ORGANIZATION_DID",
				"--email=admin@node",
				"--scope=tenant-admin,doo",
				`--output-json=${OUTPUT_TMP_DIR}user-account-admin.json`,
				`--output-env=${OUTPUT_TMP_DIR}user-account-admin.env`,
				"--output-env-prefix=admin"
			],
			{ nodeId: nodeIdentityJson?.did, nodeTenantId: nodeTenantJson?.tenantId }
		);

		const userAccountAdminJson = await CLIUtils.readJsonFile<any>(
			`${OUTPUT_TMP_DIR}user-account-admin.json`
		);
		const userAccountAdminEnv = await CLIUtils.readLinesFile(
			`${OUTPUT_TMP_DIR}user-account-admin.env`
		);
		expect(userAccountAdminJson?.did).toEqual(valueFromEnv(userAccountAdminEnv?.[0]));
		expect(userAccountAdminJson?.organizationDid).toEqual(valueFromEnv(userAccountAdminEnv?.[1]));
		expect(userAccountAdminJson?.email).toEqual(valueFromEnv(userAccountAdminEnv?.[2]));
		expect(userAccountAdminJson?.password).toEqual(valueFromEnv(userAccountAdminEnv?.[3]));
		expect(userAccountAdminJson?.scope.join(",")).toEqual(valueFromEnv(userAccountAdminEnv?.[4]));
		expect(userAccountAdminJson?.givenName).toEqual(valueFromEnv(userAccountAdminEnv?.[5]));
		expect(userAccountAdminJson?.familyName).toEqual(valueFromEnv(userAccountAdminEnv?.[6]));

		const dbTable = await CLIUtils.readJsonFile<any>(
			`${OUTPUT_TMP_DIR}db/authentication-user/store.json`
		);
		expect(dbTable?.[1]?.email).toEqual("admin@node");
		expect(dbTable?.[1]?.scope).toEqual("tenant-admin,doo");

		const nodeIdParts = nodeIdentityJson?.did.split(":");
		const nodePartitionId = Converter.bytesToBase64Url(Converter.hexToBytes(nodeIdParts[2]));

		const tenantPartitionId = Converter.bytesToBase64Url(
			Converter.hexToBytes(nodeTenantJson?.tenantId)
		);
		expect(dbTable?.[1]?.partitionId).toEqual(`${nodePartitionId}/${tenantPartitionId}`);
	});

	test("Can re-create a verification method when vault key is missing in skip mode", async () => {
		// Remove the trust-assertion vault key to simulate vault/identity desync
		const vaultKeyStorePath = `${OUTPUT_TMP_DIR}db/vault-key/store.json`;
		const vaultKeysRaw = await readFile(vaultKeyStorePath, "utf8");
		const vaultKeys = JSON.parse(vaultKeysRaw);

		const trustKey = vaultKeys.find((k: { id: string }) => k.id.includes("trust-assertion"));
		expect(trustKey).toBeDefined();

		const filteredKeys = vaultKeys.filter((k: { id: string }) => !k.id.includes("trust-assertion"));
		await writeFile(vaultKeyStorePath, JSON.stringify(filteredKeys, undefined, "\t"));

		// Re-run with --overwrite-mode=skip — should detect missing vault key and re-create it
		await executeCliCommand(
			[
				"identity-verification-method-create",
				`--load-env=${OUTPUT_TMP_DIR}node-identity.env,${OUTPUT_TMP_DIR}organization-identity.env`,
				"--identity=!ORGANIZATION_DID",
				"--controller=!NODE_DID",
				"--verification-method-id=!TWIN_TRUST_VERIFICATION_METHOD_ID",
				"--overwrite-mode=skip",
				`--output-json=${OUTPUT_TMP_DIR}organization-trust-recovered.json`
			],
			{}
		);

		const recoveredJson = await CLIUtils.readJsonFile<any>(
			`${OUTPUT_TMP_DIR}organization-trust-recovered.json`
		);
		expect(recoveredJson?.verificationMethodId).toEqual(
			`${organizationIdentityJson.did}#trust-assertion`
		);

		// Verify the vault key was re-created
		const vaultKeysAfter = JSON.parse(await readFile(vaultKeyStorePath, "utf8"));
		const recoveredKey = vaultKeysAfter.find((k: { id: string }) =>
			k.id.includes("trust-assertion")
		);
		expect(recoveredKey).toBeDefined();
	});
});
