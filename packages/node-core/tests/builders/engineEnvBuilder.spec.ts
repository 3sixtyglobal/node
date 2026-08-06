// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IIotaConfig } from "@twin.org/dlt-iota";
import {
	DltConfigType,
	SchemaVersionMigrationComponentType,
	TaskSchedulerComponentType
} from "@twin.org/engine-types";
import { buildEngineConfiguration } from "../../src/builders/engineEnvBuilder.js";

describe("buildEngineConfiguration - schemaMigrationEnabled", () => {
	test("schema migration service is registered when schemaMigrationEnabled is unset (default true)", async () => {
		const config = await buildEngineConfiguration({});

		expect(config.types.schemaVersionMigrationComponent).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ type: SchemaVersionMigrationComponentType.Service })
			])
		);
	});

	test("schema migration service is registered when schemaMigrationEnabled is 'true'", async () => {
		const config = await buildEngineConfiguration({ schemaMigrationEnabled: "true" });

		expect(config.types.schemaVersionMigrationComponent).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ type: SchemaVersionMigrationComponentType.Service })
			])
		);
	});

	test("schema migration service is not registered when schemaMigrationEnabled is 'false'", async () => {
		const config = await buildEngineConfiguration({ schemaMigrationEnabled: "false" });

		expect(config.types.schemaVersionMigrationComponent).toBeUndefined();
	});
});

describe("buildEngineConfiguration - task scheduler requirement", () => {
	test("task scheduler is registered when only auditableItemGraphEnabled is set", async () => {
		const config = await buildEngineConfiguration({ auditableItemGraphEnabled: "true" });

		expect(config.types.taskSchedulerComponent).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ type: TaskSchedulerComponentType.Service })
			])
		);
	});

	test("task scheduler is not registered when no dependent component is enabled", async () => {
		const config = await buildEngineConfiguration({});

		expect(config.types.taskSchedulerComponent).toBeUndefined();
	});
});

describe("buildEngineConfiguration - IOTA DLT gas config", () => {
	test("iotaGasBudget and iotaGasReservationDuration env vars are wired through to the resolved config", async () => {
		const config = await buildEngineConfiguration({
			iotaNodeEndpoint: "https://api.testnet.iota.cafe",
			iotaNetwork: "testnet",
			iotaGasBudget: "123456789",
			iotaGasReservationDuration: "45"
		});

		const dltEntry = config.types.dltConfig?.find(entry => entry.type === DltConfigType.Iota);
		expect(dltEntry).toBeDefined();

		const iotaConfig = dltEntry?.options?.config as IIotaConfig;

		expect(iotaConfig.gasBudget).toBe(123456789);
		expect(iotaConfig.gasReservationDuration).toBe(45);
	});

	test("leaving both env vars unset preserves today's behavior (fields stay undefined)", async () => {
		const config = await buildEngineConfiguration({
			iotaNodeEndpoint: "https://api.testnet.iota.cafe",
			iotaNetwork: "testnet"
		});

		const dltEntry = config.types.dltConfig?.find(entry => entry.type === DltConfigType.Iota);
		expect(dltEntry).toBeDefined();

		const iotaConfig = dltEntry?.options?.config as IIotaConfig;

		expect(iotaConfig.gasBudget).toBeUndefined();
		expect(iotaConfig.gasReservationDuration).toBeUndefined();
	});

	test("existing coinType and gasStation fields still resolve correctly alongside the new ones", async () => {
		const config = await buildEngineConfiguration({
			iotaNodeEndpoint: "https://api.testnet.iota.cafe",
			iotaNetwork: "testnet",
			iotaCoinType: "4218",
			iotaGasStationEndpoint: "http://localhost:9527",
			iotaGasStationAuthToken: "test-token",
			iotaGasBudget: "123456789",
			iotaGasReservationDuration: "45"
		});

		const dltEntry = config.types.dltConfig?.find(entry => entry.type === DltConfigType.Iota);
		expect(dltEntry).toBeDefined();

		const iotaConfig = dltEntry?.options?.config as IIotaConfig;

		expect(iotaConfig.coinType).toBe(4218);
		expect(iotaConfig.gasStation).toStrictEqual({
			gasStationUrl: "http://localhost:9527",
			gasStationAuthToken: "test-token"
		});
		expect(iotaConfig.gasBudget).toBe(123456789);
		expect(iotaConfig.gasReservationDuration).toBe(45);
	});
});
