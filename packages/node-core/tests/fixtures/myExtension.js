// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Initialise the extension.
 * @param envVars The environment variables for the node.
 * @param nodeEngineConfig The node engine config.
 */
export async function extensionInitialise(envVars, nodeEngineConfig) {
	// eslint-disable-next-line no-console
	console.log('extensionInitialise called');
}

/**
 * Initialise the engine for the extension.
 * @param engineCore The engine core instance.
 */
export async function extensionInitialiseEngine(engineCore) {
	// eslint-disable-next-line no-console
	console.log('extensionInitialiseEngine called');
}

/**
 * Initialise the engine server for the extension.
 * @param engineCore The engine core instance.
 * @param engineServer The engine server instance.
 */
export async function extensionInitialiseEngineServer(engineCore, engineServer) {
	// eslint-disable-next-line no-console
	console.log('extensionInitialiseEngineServer called');
}

/**
 * Shutdown the extension.
 */
export async function extensionShutdown() {
	// eslint-disable-next-line no-console
	console.log('extensionShutdown called');
}
