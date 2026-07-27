// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { ContextIdKeys, ContextIdStore } from "@twin.org/context";
import { ComponentFactory, Factory } from "@twin.org/core";
import { MemoryStateStorage } from "@twin.org/engine-core";
import { EntityStorageConnectorType } from "@twin.org/engine-types";
import type { ITelemetryComponent } from "@twin.org/telemetry-models";
import { CI_ENV_VARS } from "./setupTestEnv.js";
import { run } from "../src/node.js";

const BASE_PORT = 4500 + Math.floor(Math.random() * 400);
const TEST_NODE_ID =
	"did:iota:testnet:0x8f7b71cedde408974606e404bce76980fd17a570d03ec319788fefd5eabbe9e8";
const TEST_NODE_ORG_ID =
	"did:iota:testnet:0x7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b";

const LIBRARY_METRIC_IDS = [
	"system_cpu_usage_percent",
	"system_memory_total_bytes",
	"system_memory_used_bytes",
	"system_memory_free_bytes",
	"system_memory_usage_percent",
	"system_uptime_seconds",
	"process_uptime_seconds",
	"process_memory_rss_bytes",
	"process_memory_heap_total_bytes",
	"process_memory_heap_used_bytes"
];

describe("System metrics E2E", () => {
	let shutdown: (() => Promise<void>) | undefined;
	let telemetry: ITelemetryComponent | undefined;

	beforeAll(async () => {
		const result = await run(
			{
				localesDirectory: "./dist/locales/",
				stateStorage: new MemoryStateStorage(false, {
					nodeId: TEST_NODE_ID,
					nodeOrganizationId: TEST_NODE_ORG_ID
				}),
				disableProcessExitOnFailure: true,
				envVars: {
					TWIN_SILENT: "true",
					TWIN_PORT: BASE_PORT.toString(),
					TWIN_ENTITY_STORAGE_CONNECTOR_TYPE: EntityStorageConnectorType.Memory,
					TWIN_TELEMETRY_CONNECTOR: "entity-storage",
					// Large interval so only the startup tick fires during the test
					TWIN_TELEMETRY_METRICS_COLLECTOR_INTERVAL: "3600",
					TWIN_SCHEMA_MIGRATION_ENABLED: "false",
					TWIN_ENV_ALLOW_LIST: CI_ENV_VARS
				}
			},
			["node", "index.js"]
		);

		shutdown = result?.shutdown;

		const telemetryType = result?.engine.getRegisteredInstanceType("telemetryComponent");
		if (telemetryType) {
			telemetry = ComponentFactory.get<ITelemetryComponent>(telemetryType);
		}
	}, 60_000);

	afterAll(async () => {
		await shutdown?.();
		Factory.clearFactories();
	});

	test("telemetry component is registered when enabled", () => {
		expect(telemetry).toBeDefined();
	});

	test.each(LIBRARY_METRIC_IDS)(
		"metric '%s' is registered and has at least one value",
		async id => {
			expect(telemetry).toBeDefined();
			const result = await ContextIdStore.run(
				{ [ContextIdKeys.Node]: TEST_NODE_ID, [ContextIdKeys.Organization]: TEST_NODE_ORG_ID },
				async () => (telemetry as ITelemetryComponent).getMetric(id)
			);
			expect(result).toBeDefined();
			expect(result.metric).toBeDefined();
			expect(result.metric.id).toBe(id);
		}
	);
});
