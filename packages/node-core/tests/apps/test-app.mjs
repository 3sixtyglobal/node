// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
/**
 * Test Data Space Connector App initializer.
 * @param core The engine core.
 * @param context The context for the engine.
 * @param instanceConfig The instance config.
 * @param instanceConfig.options The instance config options.
 * @param overrideInstanceType The instance type to override the default.
 * @returns The name of the instance created.
 */
export function appInitialiser(core, context, instanceConfig, overrideInstanceType) {
	// eslint-disable-next-line no-console
	console.log('Loaded custom app module');
	return '';
}
