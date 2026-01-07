// Copyright 2025 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { ContextIdHelper, ContextIdKeys, ContextIdStore } from '@twin.org/context';
import { ComponentFactory } from '@twin.org/core';
import { DataTypeHandlerFactory } from '@twin.org/data-core';
import { DcatClasses } from '@twin.org/standards-w3c-dcat';
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
	_nodeId;

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
	 * Returns the class name of the component.
	 * @returns The class name of the component.
	 */
	className() {
		return TestDataSpaceConnectorApp.CLASS_NAME;
	}

	/**
	 * Datasets handled by the App.
	 * @returns DS Protocol compliant datasets
	 */
	datasetsHandled() {
		return [
			{
				'@id': 'https://twin.example.org/data-service-1',
				'@type': DcatClasses.Dataset,
				'odrl:hasPolicy': [
					{
						'@context': 'http://www.w3.org/ns/odrl.jsonld',
						'@type': 'Offer',
						'@id': 'urn:uuid:test-policy-offer-1',
						uid: 'urn:uuid:test-policy-offer-1',
						assigner: 'https://twin.example.org',
						permission: []
					}
				],
				'dcat:distribution': {
					'@id': 'https://twin.example.org/distribution-1',
					'@type': 'Distribution',
					'dcat:accessService': 'https://twin.example.org/data-service-1',
					'dcterms:format': 'Http-Pull-Query-Format'
				},
				'dcterms:type': 'https://vocabulary.uncefact.org/Consignment'
			}
		];
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
			message: `Node Identity: ${this._nodeId ?? ''}`
		});
		await new Promise(resolve => setTimeout(resolve, 500));
		return '1234';
	}

	/**
	 * Handles the Data Request.
	 * @param dataRequest The data request
	 * @returns the Data.
	 */
	async handleDataRequest(dataRequest) {
		switch (dataRequest.type) {
			case 'DataAssetEntities': {
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
			case 'QueryDataAsset':
				return { data: entities };
		}
	}
}
