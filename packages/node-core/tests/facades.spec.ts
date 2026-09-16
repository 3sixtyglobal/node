// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { ContextIdKeys, ContextIdStore } from "@twin.org/context";
import { ComponentFactory, Factory } from "@twin.org/core";
import { MemoryStateStorage } from "@twin.org/engine-core";
import { EngineCloneMode } from "@twin.org/engine-models";
import {
	EntityStorageConnectorType,
	FacadeType,
	TracingComponentType,
	TracingConnectorType
} from "@twin.org/engine-types";
import { TracingFacade, TracingFacadeAttributes } from "@twin.org/tracing-facades";
import { type ISpan, SpanStatus, TracingConnectorFactory } from "@twin.org/tracing-models";
import { CI_ENV_VARS, getFreePort } from "./setupTestEnv.js";
import { buildEngineConfiguration } from "../src/builders/engineEnvBuilder.js";
import {
	DEFAULT_TRACING_FACADE_COMPONENT_EXCLUDE_TYPES,
	DEFAULT_TRACING_FACADE_FACTORIES,
	TRACING_FACADE_NAME
} from "../src/defaults.js";
import { run } from "../src/node.js";

const TEST_NODE_ID = "did:iota:testnet:0x1234";
const TEST_ORG_ID =
	"did:iota:testnet:0x7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b";
const CHILD_SERVICE = "child-service";
const PARENT_SERVICE = "parent-service";

describe("buildEngineConfiguration - tracing facades", () => {
	test("activates the facade on the default factories when the tracing facade is requested", async () => {
		const config = await buildEngineConfiguration({
			tracingConnector: TracingConnectorType.Console,
			facade: FacadeType.Tracing
		});

		expect(config.types.facade).toEqual([
			expect.objectContaining({ type: FacadeType.Tracing, cloneMode: EngineCloneMode.Always })
		]);
		expect(Object.keys(config.facades ?? {})).toEqual([
			"component",
			"nft-connector",
			"identity-connector",
			"attestation",
			"notarization-connector",
			"blob-storage",
			"vault",
			"wallet-connector"
		]);

		for (const factoryTypeName of DEFAULT_TRACING_FACADE_FACTORIES) {
			expect(config.facades?.[factoryTypeName]).toEqual([
				expect.objectContaining({ name: TRACING_FACADE_NAME })
			]);
		}
	});

	test("excludes the types the facade itself uses from the component factory only", async () => {
		const config = await buildEngineConfiguration({
			tracingConnector: TracingConnectorType.Console,
			facade: FacadeType.Tracing
		});

		// Only the component factory holds the components the facade itself calls.
		expect(config.facades?.component[0].excludeTypes).toEqual(
			DEFAULT_TRACING_FACADE_COMPONENT_EXCLUDE_TYPES
		);
		expect(config.facades?.vault[0].excludeTypes).toBeUndefined();
	});

	test("configures no facades when there is no tracing connector", async () => {
		const config = await buildEngineConfiguration({
			facade: FacadeType.Tracing,
			tracingFacadeFactories: "component"
		});

		expect(config.types.facade).toEqual([]);
		expect(config.facades).toEqual({});
	});

	test("replaces the default factories rather than adding to them", async () => {
		const config = await buildEngineConfiguration({
			tracingConnector: TracingConnectorType.Console,
			facade: FacadeType.Tracing,
			tracingFacadeFactories: "vault"
		});

		expect(Object.keys(config.facades ?? {})).toEqual(["vault"]);
	});

	test("configures no facades when the facade env var is not set", async () => {
		const config = await buildEngineConfiguration({
			tracingConnector: TracingConnectorType.Console
		});

		expect(config.types.facade).toBeUndefined();
		expect(config.facades).toBeUndefined();
		expect(config.types.tracingComponent).toEqual(
			expect.arrayContaining([expect.objectContaining({ type: TracingComponentType.Service })])
		);
	});

	test("falls back to the default factories when the factories list is empty", async () => {
		const config = await buildEngineConfiguration({
			tracingConnector: TracingConnectorType.Console,
			facade: FacadeType.Tracing,
			tracingFacadeFactories: ",,"
		});

		expect(Object.keys(config.facades ?? {})).toEqual(DEFAULT_TRACING_FACADE_FACTORIES);
	});

	test("registers the facade once for a factory named more than once", async () => {
		const config = await buildEngineConfiguration({
			tracingConnector: TracingConnectorType.Console,
			facade: FacadeType.Tracing,
			tracingFacadeFactories: "vault,vault"
		});

		expect(config.facades?.vault).toEqual([expect.objectContaining({ name: TRACING_FACADE_NAME })]);
	});

	test("throws when the facade type is not a known value", async () => {
		await expect(
			buildEngineConfiguration({
				tracingConnector: TracingConnectorType.Console,
				facade: "not-a-facade"
			})
		).rejects.toThrow("invalidEnvVarValue");
	});

	test("extends the component exclusions rather than replacing them", async () => {
		const config = await buildEngineConfiguration({
			tracingConnector: TracingConnectorType.Console,
			facade: FacadeType.Tracing,
			tracingFacadeComponentExcludeTypes: "^my-tracing-service$"
		});

		expect(config.facades?.component[0].excludeTypes).toEqual([
			...DEFAULT_TRACING_FACADE_COMPONENT_EXCLUDE_TYPES,
			"^my-tracing-service$"
		]);
		expect(DEFAULT_TRACING_FACADE_COMPONENT_EXCLUDE_TYPES.length).toBeGreaterThan(0);
	});

	test("does not repeat a component exclusion which is already a default", async () => {
		const config = await buildEngineConfiguration({
			tracingConnector: TracingConnectorType.Console,
			facade: FacadeType.Tracing,
			tracingFacadeComponentExcludeTypes: `${DEFAULT_TRACING_FACADE_COMPONENT_EXCLUDE_TYPES[0]},^my-tracing-service$`
		});

		expect(config.facades?.component[0].excludeTypes).toEqual([
			...DEFAULT_TRACING_FACADE_COMPONENT_EXCLUDE_TYPES,
			"^my-tracing-service$"
		]);
	});

	test("passes the option lists through to the facade config", async () => {
		const config = await buildEngineConfiguration({
			tracingConnector: TracingConnectorType.Console,
			facade: FacadeType.Tracing,
			tracingFacadeExcludeParams: "ssn",
			tracingFacadeExcludeMethods: "health",
			tracingFacadeIncludeObjects: "filter.id,resolved.id"
		});

		expect(config.types.facade?.[0].options?.config).toEqual({
			excludeParams: [...TracingFacade.DEFAULT_EXCLUDE_PARAMS, "ssn"],
			excludeMethods: [...TracingFacade.DEFAULT_EXCLUDE_METHODS, "health"],
			includeObjects: ["filter.id", "resolved.id"]
		});
	});

	test("does not repeat an option list entry which is already a default", async () => {
		const config = await buildEngineConfiguration({
			tracingConnector: TracingConnectorType.Console,
			facade: FacadeType.Tracing,
			tracingFacadeExcludeParams: `${TracingFacade.DEFAULT_EXCLUDE_PARAMS[0]},ssn`,
			tracingFacadeExcludeMethods: `${TracingFacade.DEFAULT_EXCLUDE_METHODS[0]},health`
		});

		expect(config.types.facade?.[0].options?.config).toEqual({
			excludeParams: [...TracingFacade.DEFAULT_EXCLUDE_PARAMS, "ssn"],
			excludeMethods: [...TracingFacade.DEFAULT_EXCLUDE_METHODS, "health"],
			includeObjects: undefined
		});
	});

	test("leaves the facade options undefined when no option lists are set", async () => {
		const config = await buildEngineConfiguration({
			tracingConnector: TracingConnectorType.Console,
			facade: FacadeType.Tracing
		});

		expect(config.types.facade?.[0].options).toBeUndefined();
	});
});

/**
 * Starts a node with the entity storage tracing connector backed by memory storage, calls the
 * given endpoints, and returns only the spans those calls produced.
 * @param extraEnvVars The env vars to apply on top of the tracing baseline.
 * @param paths The endpoint paths to call in order.
 * @returns The spans recorded while the endpoints were being called.
 */
async function traceEndpointCalls(
	extraEnvVars: { [id: string]: string },
	paths: string[]
): Promise<ISpan[]> {
	Factory.clearFactories();
	const port = await getFreePort();

	const result = await run({
		localesDirectory: "./dist/locales/",
		stateStorage: new MemoryStateStorage(false, {
			nodeId: TEST_NODE_ID,
			nodeOrganizationId: TEST_ORG_ID
		}),
		disableProcessExitOnFailure: true,
		envVars: {
			TWIN_SILENT: "true",
			TWIN_PORT: String(port),
			TWIN_ENTITY_STORAGE_CONNECTOR_TYPE: EntityStorageConnectorType.Memory,
			TWIN_TRACING_CONNECTOR: TracingConnectorType.EntityStorage,
			TWIN_SCHEMA_MIGRATION_ENABLED: "false",
			TWIN_ENV_ALLOW_LIST: CI_ENV_VARS,
			...extraEnvVars
		}
	});

	const connectorType = result?.engine.getRegisteredInstanceTypeOptional("tracingConnector");

	/**
	 * Read every span the tracing connector currently holds, flushing any it has batched.
	 * @returns The spans.
	 */
	async function querySpans(): Promise<ISpan[]> {
		if (!connectorType) {
			return [];
		}
		const connector = TracingConnectorFactory.get(connectorType);
		let entities: ISpan[] = [];
		await ContextIdStore.run({ [ContextIdKeys.Node]: TEST_NODE_ID }, async () => {
			const queried = await (
				connector as unknown as { query: () => Promise<{ entities: ISpan[] }> }
			).query();
			entities = queried.entities;
		});
		return entities;
	}

	// The memory entity storage outlives a single run, so anything already recorded is discounted
	// rather than assumed absent.
	const existingSpanIds = new Set((await querySpans()).map(span => span.context?.spanId));

	try {
		for (const endpointPath of paths) {
			const response = await fetch(`http://localhost:${port}${endpointPath}`);
			expect(response.status).toBe(200);
		}

		return (await querySpans()).filter(span => !existingSpanIds.has(span.context?.spanId));
	} finally {
		await result?.shutdown();
	}
}

describe("tracing facade - recorded spans", () => {
	test("records a span for each traced method an endpoint calls", async () => {
		const spans = await traceEndpointCalls({ TWIN_FACADE: FacadeType.Tracing }, [
			"/info",
			"/livez",
			"/readyz"
		]);

		expect(spans.map(span => span.name).sort()).toEqual([
			"method:InformationService.info",
			"method:InformationService.livez",
			"method:InformationService.readyz"
		]);
	});

	test("records a span with values a trace viewer can use", async () => {
		const spans = await traceEndpointCalls({ TWIN_FACADE: FacadeType.Tracing }, ["/info"]);

		expect(spans).toHaveLength(1);

		const span = spans[0];
		expect(span.name).toBe("method:InformationService.info");
		expect(span.status).toBe(SpanStatus.Ok);
		expect(span.attributes?.[TracingFacadeAttributes.Method]).toBe("InformationService.info");

		// A span is only useful if it can be correlated and timed.
		expect(span.context?.traceId).toMatch(/^[0-9a-f]{32}$/);
		expect(span.context?.spanId).toMatch(/^[0-9a-f]{16}$/);
		expect(span.startTs).toBeGreaterThan(0);
		expect(span.endTs).toBeGreaterThanOrEqual(span.startTs);
		expect(span.durationMs).toBeGreaterThanOrEqual(0);
		expect(span.durationMs).toBe((span.endTs ?? 0) - span.startTs);
	});

	test("gives each endpoint call its own trace", async () => {
		const spans = await traceEndpointCalls({ TWIN_FACADE: FacadeType.Tracing }, [
			"/livez",
			"/livez"
		]);

		expect(spans).toHaveLength(2);
		expect(spans[0].context?.traceId).not.toBe(spans[1].context?.traceId);
	});

	test("records no spans when the facade is not activated", async () => {
		const spans = await traceEndpointCalls({}, ["/info", "/livez", "/readyz"]);

		expect(spans).toEqual([]);
	});

	test("does not trace the components the facade itself calls", async () => {
		const spans = await traceEndpointCalls({ TWIN_FACADE: FacadeType.Tracing }, [
			"/info",
			"/livez",
			"/readyz"
		]);

		// Tracing a component the facade itself calls would recurse back through the facade.
		const tracedTypes = spans.map(span => span.name.toLowerCase());
		for (const excluded of DEFAULT_TRACING_FACADE_COMPONENT_EXCLUDE_TYPES) {
			expect(tracedTypes.filter(name => name.includes(excluded.toLowerCase()))).toEqual([]);
		}
	});

	test("does not trace a method named in the exclusions", async () => {
		const spans = await traceEndpointCalls(
			{
				TWIN_FACADE: FacadeType.Tracing,
				TWIN_TRACING_FACADE_EXCLUDE_METHODS: "info"
			},
			["/info", "/livez"]
		);

		expect(spans.map(span => span.name)).toEqual(["method:InformationService.livez"]);
	});

	test("does not trace the component factory when it is not in the factory list", async () => {
		const spans = await traceEndpointCalls(
			{
				TWIN_FACADE: FacadeType.Tracing,
				TWIN_TRACING_FACADE_FACTORIES: "vault"
			},
			["/info", "/livez"]
		);

		expect(spans).toEqual([]);
	});

	test("serves endpoints normally when the facade is activated without a tracing connector", async () => {
		// The facade has no tracing subsystem to record to here, so the only thing worth proving is
		// that requesting it does not stop the node serving - traceEndpointCalls asserts each
		// response is a 200.
		await expect(
			traceEndpointCalls(
				{
					TWIN_FACADE: FacadeType.Tracing,
					TWIN_TRACING_CONNECTOR: ""
				},
				["/info", "/livez", "/readyz"]
			)
		).resolves.toEqual([]);
	});
});

/**
 * A component the facade wraps, standing in for a leaf service which takes credentials and
 * returns a record.
 */
class ChildService {
	/**
	 * The arguments of the last lookup, so a test can prove the facade passes a call through
	 * unaltered.
	 */
	public lastLookup?: { id: string; apiKey: string; password: string; custom: string };

	/**
	 * Returns the class name of the component.
	 * @returns The class name of the component.
	 */
	public className(): string {
		return "ChildService";
	}

	/**
	 * Look a record up.
	 * @param id The id of the record.
	 * @param apiKey A credential excluded from tracing by default.
	 * @param password A credential excluded from tracing by default.
	 * @param custom A value only excluded when the env var names it.
	 * @returns The record.
	 */
	public async lookup(
		id: string,
		apiKey: string,
		password: string,
		custom: string
	): Promise<{ id: string; label: string }> {
		this.lastLookup = { id, apiKey, password, custom };
		return { id, label: `label-${id}` };
	}

	/**
	 * Search using an object parameter.
	 * @param filter The filter to search with.
	 * @param filter.id The id to match, recorded when the included objects name it.
	 * @param filter.secret A value which must never reach a span.
	 * @returns The matching ids.
	 */
	public async search(filter: { id: string; secret: string }): Promise<string[]> {
		return [filter.id];
	}

	/**
	 * Fail, so the span records an error.
	 * @returns Never, it always throws.
	 */
	public async explode(): Promise<void> {
		throw new Error("child blew up");
	}

	/**
	 * A synchronous method, which cannot be traced without changing its contract.
	 * @param value The value to decorate.
	 * @returns The decorated value.
	 */
	public plain(value: string): string {
		return `plain-${value}`;
	}
}

/**
 * A component the facade wraps which calls another wrapped component, so the spans nest.
 */
class ParentService {
	/**
	 * Returns the class name of the component.
	 * @returns The class name of the component.
	 */
	public className(): string {
		return "ParentService";
	}

	/**
	 * Look a record up through the child component.
	 * @param id The id of the record.
	 * @returns The record.
	 */
	public async fetchThrough(id: string): Promise<{ id: string; label: string }> {
		return ComponentFactory.get<ChildService>(CHILD_SERVICE).lookup(
			id,
			"super-secret-key",
			"hunter2",
			"custom-value"
		);
	}

	/**
	 * Call a child method which throws.
	 * @returns Never, it always throws.
	 */
	public async fetchFailing(): Promise<void> {
		await ComponentFactory.get<ChildService>(CHILD_SERVICE).explode();
	}
}

/**
 * Starts a node with the tracing facade active, registers the test components so the facade wraps
 * them, runs the given calls, and returns only the spans those calls produced.
 * @param extraEnvVars The env vars to apply on top of the tracing baseline.
 * @param calls Receives the wrapped components and makes the calls to be traced.
 * @returns The spans recorded while the calls were being made.
 */
async function traceComponentCalls(
	extraEnvVars: { [id: string]: string },
	calls: (parent: ParentService, child: ChildService) => Promise<void>
): Promise<ISpan[]> {
	Factory.clearFactories();

	const result = await run({
		localesDirectory: "./dist/locales/",
		stateStorage: new MemoryStateStorage(false, {
			nodeId: TEST_NODE_ID,
			nodeOrganizationId: TEST_ORG_ID
		}),
		disableProcessExitOnFailure: true,
		envVars: {
			TWIN_SILENT: "true",
			TWIN_PORT: String(await getFreePort()),
			TWIN_ENTITY_STORAGE_CONNECTOR_TYPE: EntityStorageConnectorType.Memory,
			TWIN_TRACING_CONNECTOR: TracingConnectorType.EntityStorage,
			TWIN_FACADE: FacadeType.Tracing,
			TWIN_SCHEMA_MIGRATION_ENABLED: "false",
			TWIN_ENV_ALLOW_LIST: CI_ENV_VARS,
			...extraEnvVars
		}
	});

	ComponentFactory.register(CHILD_SERVICE, () => new ChildService());
	ComponentFactory.register(PARENT_SERVICE, () => new ParentService());

	const connectorType = result?.engine.getRegisteredInstanceType("tracingConnector");
	const connector = TracingConnectorFactory.get(connectorType ?? "");

	/**
	 * Read every span the tracing connector currently holds, flushing any it has batched.
	 * @returns The spans.
	 */
	async function querySpans(): Promise<ISpan[]> {
		let entities: ISpan[] = [];
		await ContextIdStore.run({ [ContextIdKeys.Node]: TEST_NODE_ID }, async () => {
			const queried = await (
				connector as unknown as { query: () => Promise<{ entities: ISpan[] }> }
			).query();
			entities = queried.entities;
		});
		return entities;
	}

	const existingSpanIds = new Set((await querySpans()).map(span => span.context?.spanId));

	try {
		// The spans are persisted against the calling context, so the calls are made inside one.
		await ContextIdStore.run({ [ContextIdKeys.Node]: TEST_NODE_ID }, async () =>
			calls(
				ComponentFactory.get<ParentService>(PARENT_SERVICE),
				ComponentFactory.get<ChildService>(CHILD_SERVICE)
			)
		);

		return (await querySpans()).filter(span => !existingSpanIds.has(span.context?.spanId));
	} finally {
		await result?.shutdown();
	}
}

/**
 * Find the single span recorded for a method.
 * @param spans The spans to search.
 * @param methodName The qualified method name.
 * @returns The span.
 */
function spanFor(spans: ISpan[], methodName: string): ISpan {
	const matching = spans.filter(
		span => span.attributes?.[TracingFacadeAttributes.Method] === methodName
	);
	expect(matching).toHaveLength(1);
	return matching[0];
}

describe("tracing facade - traced component behaviour", () => {
	test("nests an inner call inside the outer span, sharing a single trace", async () => {
		const spans = await traceComponentCalls({}, async parent => {
			await parent.fetchThrough("id-1");
		});

		const outer = spanFor(spans, "ParentService.fetchThrough");
		const inner = spanFor(spans, "ChildService.lookup");

		// A trace is only navigable if the inner call hangs off the outer one.
		expect(inner.context?.traceId).toBe(outer.context?.traceId);
		expect(inner.parentSpanId).toBe(outer.context?.spanId);
		expect(outer.parentSpanId).toBeUndefined();
	});

	test("passes the call through to the component unaltered", async () => {
		let returned: { id: string; label: string } | undefined;
		let lastLookup: ChildService["lastLookup"];

		await traceComponentCalls({}, async (parent, child) => {
			returned = await parent.fetchThrough("id-1");
			lastLookup = child.lastLookup;
		});

		expect(returned).toEqual({ id: "id-1", label: "label-id-1" });
		expect(lastLookup).toEqual({
			id: "id-1",
			apiKey: "super-secret-key",
			password: "hunter2",
			custom: "custom-value"
		});
	});

	test("records the arguments a traced method was called with", async () => {
		const spans = await traceComponentCalls({}, async parent => {
			await parent.fetchThrough("id-1");
		});

		expect(spanFor(spans, "ChildService.lookup").attributes).toMatchObject({
			[`${TracingFacadeAttributes.ParamPrefix}id`]: "id-1"
		});
	});

	test("never records a credential parameter", async () => {
		const spans = await traceComponentCalls({}, async parent => {
			await parent.fetchThrough("id-1");
		});

		const attributes = spanFor(spans, "ChildService.lookup").attributes ?? {};

		// The values were passed to the method, so their absence is redaction rather than a call
		// which never carried them.
		expect(Object.keys(attributes)).not.toContain(`${TracingFacadeAttributes.ParamPrefix}apiKey`);
		expect(Object.keys(attributes)).not.toContain(`${TracingFacadeAttributes.ParamPrefix}password`);
		expect(JSON.stringify(attributes)).not.toContain("super-secret-key");
		expect(JSON.stringify(attributes)).not.toContain("hunter2");
	});

	test("adds the excluded parameters from the env var to the built in ones", async () => {
		const spans = await traceComponentCalls(
			{ TWIN_TRACING_FACADE_EXCLUDE_PARAMS: "custom" },
			async parent => {
				await parent.fetchThrough("id-1");
			}
		);

		const attributes = spanFor(spans, "ChildService.lookup").attributes ?? {};

		expect(JSON.stringify(attributes)).not.toContain("custom-value");
		// The built in exclusions still apply alongside the configured one.
		expect(JSON.stringify(attributes)).not.toContain("super-secret-key");
		expect(attributes[`${TracingFacadeAttributes.ParamPrefix}id`]).toBe("id-1");
	});

	test("records only the named properties of an object parameter", async () => {
		const spans = await traceComponentCalls(
			{ TWIN_TRACING_FACADE_INCLUDE_OBJECTS: "filter.id" },
			async (parent, child) => {
				await child.search({ id: "f-1", secret: "do-not-record" });
			}
		);

		expect(spanFor(spans, "ChildService.search").attributes).toMatchObject({
			[`${TracingFacadeAttributes.ParamPrefix}filter`]: { id: "f-1" }
		});
		expect(JSON.stringify(spans)).not.toContain("do-not-record");
	});

	test("records every property when the object parameter itself is named", async () => {
		const spans = await traceComponentCalls(
			{ TWIN_TRACING_FACADE_INCLUDE_OBJECTS: "filter" },
			async (parent, child) => {
				await child.search({ id: "f-1", secret: "do-not-record" });
			}
		);

		// Naming the parameter rather than a property opts the whole value in, secrets included.
		expect(spanFor(spans, "ChildService.search").attributes).toMatchObject({
			[`${TracingFacadeAttributes.ParamPrefix}filter`]: { id: "f-1", secret: "do-not-record" }
		});
	});

	test("omits an object parameter entirely when no property is named", async () => {
		const spans = await traceComponentCalls({}, async (parent, child) => {
			await child.search({ id: "f-1", secret: "do-not-record" });
		});

		const attributes = spanFor(spans, "ChildService.search").attributes ?? {};

		expect(Object.keys(attributes)).not.toContain(`${TracingFacadeAttributes.ParamPrefix}filter`);
	});

	test("records the returned value when it is named in the included objects", async () => {
		const spans = await traceComponentCalls(
			{ TWIN_TRACING_FACADE_INCLUDE_OBJECTS: "resolved.id,resolved.label" },
			async parent => {
				await parent.fetchThrough("id-1");
			}
		);

		expect(spanFor(spans, "ChildService.lookup").attributes).toMatchObject({
			[TracingFacadeAttributes.Result]: { id: "id-1", label: "label-id-1" }
		});
	});

	test("marks the whole chain as an error when an inner call throws", async () => {
		let thrown: Error | undefined;

		const spans = await traceComponentCalls({}, async parent => {
			await parent.fetchFailing().catch((err: Error) => {
				thrown = err;
			});
		});

		// The facade records the failure without swallowing it.
		expect(thrown?.message).toBe("child blew up");

		const outer = spanFor(spans, "ParentService.fetchFailing");
		const inner = spanFor(spans, "ChildService.explode");

		expect(inner.status).toBe(SpanStatus.Error);
		expect(outer.status).toBe(SpanStatus.Error);
		expect(inner.parentSpanId).toBe(outer.context?.spanId);
		expect(inner.attributes?.["exception.message"]).toBe("child blew up");
	});

	test("leaves a synchronous method untraced so its contract is unchanged", async () => {
		let returned: string | undefined;

		const spans = await traceComponentCalls({}, async (parent, child) => {
			// Not awaited, a traced method would have turned this into a promise.
			returned = child.plain("abc");
			await parent.fetchThrough("id-1");
		});

		expect(returned).toBe("plain-abc");
		expect(
			spans.filter(
				span => span.attributes?.[TracingFacadeAttributes.Method] === "ChildService.plain"
			)
		).toEqual([]);
	});
});
