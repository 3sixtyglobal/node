// Copyright 2025 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { ContextIdHelper, ContextIdKeys, ContextIdStore } from '@3sixty/context';
import { ComponentFactory, Guards } from '@3sixty/core';
import { DataTypeHandlerFactory } from '@3sixty/data-core';
import { DataRequestType } from '@3sixty/dataspace-models';
// Dummy Data
const id = 'urn:ucr:24PLP051219453I002610799053311';
const entities = [
	{
		'@context': 'https://vocabulary.uncefact.org/unece-context-D23B.jsonld',
		type: 'Consignment',
		id,
		destinationCountry: {
			type: 'Country',
			countryId: 'unece:CountryId#GB'
		}
	},
	{
		'@context': 'https://vocabulary.uncefact.org/unece-context-D23B.jsonld',
		type: 'Document',
		id: 'urn:document:a3456fddaa56',
		documentTypeCode: 'unece:DocumentCodeList#853'
	}
];
/**
 * Test App Activity Handler.
 */
export class TestDataspaceDataPlaneApp {
	/**
	 * App Name.
	 */
	static APP_ID = 'https://twin.example.org/app1';

	/**
	 * Runtime name for the class.
	 */
	static CLASS_NAME = 'TestDataspaceDataPlaneApp';

	/**
	 * Logging component.
	 * @internal
	 */
	_logging;

	/**
	 * Node Identity
	 * @internal
	 */
	_nodeId;

	/**
	 * Create a new instance of TestDataspaceDataPlaneApp.
	 * @param options The constructor options.
	 */
	constructor(options) {
		this._logging = ComponentFactory.getIfExists(options?.loggingComponentType ?? 'logging');
	}

	/**
	 * Returns the class name of the component.
	 * @returns The class name of the component.
	 */
	className() {
		return TestDataspaceDataPlaneApp.CLASS_NAME;
	}

	/**
	 * Supported query types.
	 * @returns Types.
	 */
	supportedQueryTypes() {
		return ['TestQueryType'];
	}

	/**
	 * Start method.
	 * @param nodeLoggingComponentType the logging component type of such a node.
	 */
	async start(nodeLoggingComponentType) {
		const contextIds = await ContextIdStore.getContextIds();
		ContextIdHelper.guard(contextIds, ContextIdKeys.Node);
		this._nodeId = contextIds[ContextIdKeys.Node];
		DataTypeHandlerFactory.register('https://twin.example.org/MyCreate', () => ({
			namespace: 'https://twin.example.org/',
			type: 'MyCreate',
			defaultValue: {},
			jsonSchema: async () => ({
				type: 'object'
			})
		}));
		DataTypeHandlerFactory.register('https://vocabulary.uncefact.org/Consignment', () => ({
			namespace: 'https://vocabulary.uncefact.org/',
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
		Guards.object(TestDataspaceDataPlaneApp.CLASS_NAME, 'activity', activity);
		await this._logging?.log({
			level: 'info',
			source: TestDataspaceDataPlaneApp.CLASS_NAME,
			message: `App Called: ${TestDataspaceDataPlaneApp.APP_ID}`
		});
		await this._logging?.log({
			level: 'info',
			source: TestDataspaceDataPlaneApp.CLASS_NAME,
			message: `Node Identity: ${this._nodeId ?? ''}`
		});
		await new Promise(resolve => setTimeout(resolve, 500));
		return '1234';
	}

	/**
	 * Handles the Data Request.
	 * @param dataRequest The data request
	 * @param cursor Cursor that points to the next item in the result set.
	 * @param limit Maximum number of entries retrieved or to be retrieved.
	 * @returns the Data.
	 */
	async handleDataRequest(dataRequest, cursor, limit) {
		Guards.object(TestDataspaceDataPlaneApp.CLASS_NAME, 'dataRequest', dataRequest);
		switch (dataRequest.type) {
			case DataRequestType.DataAssetEntities: {
				if (dataRequest.entitySet.entityType === 'https://vocabulary.uncefact.org/Consignment') {
					return {
						data: [entities[0]]
					};
				}
				if (dataRequest.entitySet.entityId?.includes(id)) {
					return {
						data: entities[0]
					};
				}
				return { data: [] };
			}
			case DataRequestType.QueryDataAsset:
				return { data: entities };
		}
	}
}
// # sourceMappingURL=testDataspaceDataPlaneApp.js.map
