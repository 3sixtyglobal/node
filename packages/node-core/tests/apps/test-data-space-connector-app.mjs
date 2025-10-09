// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { ComponentFactory } from '@twin.org/core';
import { DataTypeHandlerFactory } from '@twin.org/data-core';

/**
 * Test App Activity Handler.
 */
export class TestDataSpaceConnectorApp {
	/**
	 * App Name.
	 */
	static APP_ID = 'https://twin.example.org/app1';

	/**
	 * Runtime name for the class.
	 */
	static CLASS_NAME = 'TestDataSpaceConnectorApp';

	/**
	 * Data space connector component.
	 * @internal
	 */
	_dataSpaceConnectorComponent;

	/**
	 * Logging service.
	 * @internal
	 */
	_loggingService;

	/**
	 * Node Identity
	 * @internal
	 */
	_nodeIdentity;

	/**
	 * Create a new instance of TestDataSpaceConnectorApp.
	 * @param options The constructor options.
	 */
	constructor(options) {
		this._dataSpaceConnectorComponent = ComponentFactory.get(
			options?.dataSpaceConnectorComponentType ?? 'data-space-connector'
		);
		this._loggingService = ComponentFactory.getIfExists(options?.loggingComponentType ?? 'logging');
	}

	/**
	 * Start method.
	 * @param nodeIdentity the identity of the node where this application lives.
	 * @param nodeLoggingComponentType the logging component type of such a node.
	 */
	async start(nodeIdentity, nodeLoggingComponentType) {
		this._nodeIdentity = nodeIdentity;
		await this._dataSpaceConnectorComponent.registerApp(TestDataSpaceConnectorApp.APP_ID, this);
		DataTypeHandlerFactory.register('https://twin.example.org/MyCreate', () => ({
			context: 'https://twin.example.org/',
			type: 'MyCreate',
			defaultValue: {},
			jsonSchema: async () => ({
				type: 'object'
			})
		}));
		DataTypeHandlerFactory.register('https://vocabulary.uncefact.org/Consignment', () => ({
			context: 'https://vocabulary.uncefact.org/',
			type: 'Consignment',
			defaultValue: {},
			jsonSchema: async () => ({
				type: 'object'
			})
		}));
	}

	/**
	 * The activities handled by the App.
	 * @returns The activities handled by the App.
	 */
	activitiesHandled() {
		return [{ objectType: 'https://vocabulary.uncefact.org/Consignment' }];
	}

	/**
	 * Handle Activity.
	 * @param activity Activity
	 * @returns Activity processing result
	 */
	async handleActivity(activity) {
		await this._loggingService?.log({
			level: 'info',
			source: TestDataSpaceConnectorApp.CLASS_NAME,
			message: `App Called: ${TestDataSpaceConnectorApp.APP_ID}`
		});
		await this._loggingService?.log({
			level: 'info',
			source: TestDataSpaceConnectorApp.CLASS_NAME,
			message: `Node Identity: ${this._nodeIdentity ?? ''}`
		});
		await new Promise(resolve => setTimeout(resolve, 500));
		return '1234';
	}
}
