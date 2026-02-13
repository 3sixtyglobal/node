// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { DataSpaceConnectorAppFactory } from '@twin.org/data-space-connector-models';
import { TestDataSpaceConnectorApp } from './test-data-space-connector-app.js';

/**
 * Initialise the  extension.
 * @param envVars The environment variables for the node.
 * @param nodeEngineConfig The node engine config.
 */
export async function extensionInitialise(envVars, nodeEngineConfig) {
	nodeEngineConfig.types.testAppComponent = [
		{
			type: 'service',
			options: {}
		}
	];
}
/**
 * Initialise the engine for the extension.
 * @param engineCore The engine core instance.
 */
export async function extensionInitialiseEngine(engineCore) {
	engineCore.addTypeInitialiser('testAppComponent', import.meta.url, 'testAppInitialiser');
}
/**
 * Initialise the engine server for the extension.
 * @param engineCore The engine core instance.
 * @param engineServer The engine server instance.
 */
export async function extensionInitialiseEngineServer(engineCore, engineServer) {
	engineServer.addRestRouteGenerator('testAppComponent', import.meta.url, 'generateRestRoutes');
}
/**
 * Test Data Space Connector App initializer.
 * @param engineCore The engine core.
 * @param context The context for the engine.
 * @param instanceConfig The instance config.
 * @param instanceConfig.options The instance config options.
 * @param instanceConfig.type The instance type.
 * @returns The instance created and the factory for it.
 */
export function testAppInitialiser(engineCore, context, instanceConfig) {
	let createComponent;
	let instanceTypeName;
	if (instanceConfig.type === 'service') {
		createComponent = createOptions =>
			new TestDataSpaceConnectorApp({
				dataSpaceConnectorComponentType: engineCore.getRegisteredInstanceType(
					'dataSpaceConnectorComponent'
				),
				loggingComponentType: engineCore.getRegisteredInstanceType('loggingComponent'),
				...createOptions.options
			});
		instanceTypeName = TestDataSpaceConnectorApp.APP_ID;
	}
	return {
		instanceTypeName,
		factory: DataSpaceConnectorAppFactory,
		createComponent
	};
}
/**
 * Generate the rest routes for the component.
 * @param baseRouteName The base route name.
 * @param componentName The component name.
 * @returns The rest routes.
 */
export function generateRestRoutes(baseRouteName, componentName) {
	return [];
}
