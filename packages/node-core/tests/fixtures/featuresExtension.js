// Copyright 2026 3Sixty Trade Ltd.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Initialise the extension.
 * @param envVars The environment variables for the node.
 * @param nodeEngineConfig The node engine config.
 */
export async function extensionInitialise(envVars, nodeEngineConfig) {}

/**
 * The features the extension provides.
 * @param envVars The environment variables for the node.
 * @returns The features.
 */
export async function extensionFeatures(envVars) {
	return [
		{ name: 'supply-chain', roles: ['user'], config: { title: 'Supply chain' } },
		{ name: 'reports', roles: ['global-admin'] }
	];
}
