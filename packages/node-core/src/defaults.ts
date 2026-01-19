// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

export const ATTESTATION_VERIFICATION_METHOD_ID = "attestation-assertion";
export const IMMUTABLE_PROOF_VERIFICATION_METHOD_ID = "immutable-proof-assertion";
export const BLOB_STORAGE_ENCRYPTION_KEY_ID = "blob-encryption";
export const SYNCHRONISED_STORAGE_BLOB_STORAGE_ENCRYPTION_KEY_ID =
	"synchronised-storage-blob-encryption";
export const VC_AUTHENTICATION_VERIFICATION_METHOD_ID = "vc-authentication-assertion";
export const AUTH_SIGNING_KEY_ID = "auth-signing";
export const CONTEXT_ID_HANDLER_FEATURE_DID = "did";
export const CONTEXT_ID_HANDLER_FEATURE_TENANT = "tenant";

/**
 * Get the default environment variables for the node.
 * @param envPrefix The environment variable prefix.
 * @returns The default environment variables.
 */
export function getEnvDefaults(envPrefix: string): { [key: string]: string } {
	const envVars: { [key: string]: string } = {
		[`${envPrefix}ATTESTATION_VERIFICATION_METHOD_ID`]: ATTESTATION_VERIFICATION_METHOD_ID,
		[`${envPrefix}IMMUTABLE_PROOF_VERIFICATION_METHOD_ID`]: IMMUTABLE_PROOF_VERIFICATION_METHOD_ID,
		[`${envPrefix}BLOB_STORAGE_ENCRYPTION_KEY_ID`]: BLOB_STORAGE_ENCRYPTION_KEY_ID,
		[`${envPrefix}SYNCHRONISED_STORAGE_BLOB_STORAGE_ENCRYPTION_KEY_ID`]:
			SYNCHRONISED_STORAGE_BLOB_STORAGE_ENCRYPTION_KEY_ID,
		[`${envPrefix}VC_AUTHENTICATION_VERIFICATION_METHOD_ID`]:
			VC_AUTHENTICATION_VERIFICATION_METHOD_ID,
		[`${envPrefix}TRUST_VERIFICATION_METHOD_ID`]: VC_AUTHENTICATION_VERIFICATION_METHOD_ID,
		[`${envPrefix}AUTH_SIGNING_KEY_ID`]: AUTH_SIGNING_KEY_ID
	};
	return envVars;
}
