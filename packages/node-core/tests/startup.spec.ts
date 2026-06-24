// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { ITenantAdminComponent } from "@twin.org/api-models";
import { ContextIdStore } from "@twin.org/context";
import { ComponentFactory, Factory } from "@twin.org/core";
import { MemoryStateStorage } from "@twin.org/engine-core";
import { EntityStorageConnectorType } from "@twin.org/engine-types";
import { entity, EntitySchemaFactory, EntitySchemaHelper, property } from "@twin.org/entity";
import { MemoryEntityStorageConnector } from "@twin.org/entity-storage-connector-memory";
import { CI_ENV_VARS } from "./setupTestEnv.js";
import { run } from "../src/node.js";

@entity()
class LegacyTenant {
	@property({ type: "string", isPrimary: true })
	public id!: string;

	@property({ type: "string" })
	public apiKey!: string;

	@property({ type: "string" })
	public label!: string;

	@property({ type: "string" })
	public dateCreated!: string;

	@property({ type: "string" })
	public dateModified!: string;

	@property({ type: "string", optional: true })
	public organizationId?: string;
}

const LOCALES_DIR = "./dist/locales/";

const TEST_NODE_ID = "did:iota:testnet:0x1234";
const TEST_ORG_ID =
	"did:iota:testnet:0x7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b";
const TEST_TENANT_ID_A = "a0000000000000000000000000000001";
const TEST_TENANT_ID_B = "b0000000000000000000000000000002";
const TEST_API_KEY_A = "c0000000000000000000000000000001";
const TEST_API_KEY_B = "d0000000000000000000000000000002";

const BASE_ENV: { [id: string]: string } = {
	TWIN_SILENT: "true",
	TWIN_ENTITY_STORAGE_CONNECTOR_TYPE: EntityStorageConnectorType.Memory,
	TWIN_TENANT_ENABLED: "true",
	TWIN_ENV_ALLOW_LIST: CI_ENV_VARS
};

/**
 * Extract the tenant admin component from a running node result.
 * @param result The result of a run() call.
 * @returns The tenant admin component.
 * @throws Error if the component is not registered.
 */
function getTenantAdminComponent(result: Awaited<ReturnType<typeof run>>): ITenantAdminComponent {
	const type = result?.engine?.getRegisteredInstanceTypeOptional("tenantAdminComponent");
	if (!type) {
		throw new Error("tenantAdminComponent not registered");
	}
	return ComponentFactory.get<ITenantAdminComponent>(type);
}

describe("startup - tenant organization ID enforcement", () => {
	beforeAll(() => {
		ContextIdStore.getContextIds = vi.fn().mockImplementation(() => ({
			node: "did:iota:testnet:0x1234",
			tenant: TEST_TENANT_ID_A
		}));
	});

	beforeEach(() => {
		Factory.clearFactories();
	});

	test("auto-assigns nodeOrganizationId to the sole tenant missing an org ID when state has nodeOrganizationId", async () => {
		const PORT_1 = 26000 + Math.floor(Math.random() * 200);
		const PORT_2 = PORT_1 + 300;

		// Run 1: start with an empty tenant table, then create a tenant without an org ID.
		const run1 = await run({
			localesDirectory: LOCALES_DIR,
			stateStorage: new MemoryStateStorage(false, { nodeId: TEST_NODE_ID }),
			disableProcessExitOnFailure: true,
			envVars: { ...BASE_ENV, TWIN_PORT: String(PORT_1) }
		});

		const comp1 = getTenantAdminComponent(run1);
		await comp1.create({
			id: TEST_TENANT_ID_A,
			apiKey: TEST_API_KEY_A,
			label: "Legacy Tenant",
			organizationId: TEST_ORG_ID
		});

		await run1?.shutdown();

		// Run 2: nodeOrganizationId is in state → the sole tenant should be auto-recovered.
		const run2 = await run({
			localesDirectory: LOCALES_DIR,
			stateStorage: new MemoryStateStorage(false, {
				nodeId: TEST_NODE_ID,
				nodeOrganizationId: TEST_ORG_ID
			}),
			disableProcessExitOnFailure: true,
			envVars: { ...BASE_ENV, TWIN_PORT: String(PORT_2) }
		});

		try {
			const comp2 = getTenantAdminComponent(run2);
			const { tenants } = await comp2.query(undefined, ["id", "organizationId"]);
			const patched = tenants.find(t => t.id === TEST_TENANT_ID_A);
			expect(patched?.organizationId).toBe(TEST_ORG_ID);
		} finally {
			await run2?.shutdown();
		}
	});

	test("blocks startup when the sole tenant missing an org ID has no nodeOrganizationId to recover from", async () => {
		const PORT_1 = 26500 + Math.floor(Math.random() * 200);
		const PORT_2 = PORT_1 + 300;

		// Run 1: seed a tenant without an org ID.
		const run1 = await run({
			localesDirectory: LOCALES_DIR,
			stateStorage: new MemoryStateStorage(false, { nodeId: TEST_NODE_ID }),
			disableProcessExitOnFailure: true,
			envVars: { ...BASE_ENV, TWIN_PORT: String(PORT_1) }
		});

		EntitySchemaFactory.register("LegacyTenant", () => EntitySchemaHelper.getSchema(LegacyTenant));
		const seedConnector2 = new MemoryEntityStorageConnector<LegacyTenant>({
			entitySchema: "LegacyTenant",
			partitionContextIds: ["node"],
			config: { storageKey: "tenant" }
		});
		await seedConnector2.setBatch([
			{
				id: TEST_TENANT_ID_A,
				apiKey: TEST_API_KEY_A,
				label: "Legacy Tenant",
				dateCreated: new Date().toISOString(),
				dateModified: new Date().toISOString()
			}
		]);

		await run1?.shutdown();

		// Run 2: no nodeOrganizationId in state - cannot auto-recover, must throw.
		await expect(
			run({
				localesDirectory: LOCALES_DIR,
				stateStorage: new MemoryStateStorage(false, { nodeId: TEST_NODE_ID }),
				disableProcessExitOnFailure: true,
				envVars: { ...BASE_ENV, TWIN_PORT: String(PORT_2) }
			})
		).rejects.toThrow();
	});

	test("blocks startup and lists all tenant IDs when multiple tenants are missing an org ID", async () => {
		const PORT_1 = 26700 + Math.floor(Math.random() * 200);
		const PORT_2 = PORT_1 + 300;

		// Run 1: seed two tenants, neither with an org ID.
		const run1 = await run({
			localesDirectory: LOCALES_DIR,
			stateStorage: new MemoryStateStorage(false, {
				nodeId: TEST_NODE_ID,
				nodeOrganizationId: TEST_ORG_ID
			}),
			disableProcessExitOnFailure: true,
			envVars: { ...BASE_ENV, TWIN_PORT: String(PORT_1) }
		});

		EntitySchemaFactory.register("LegacyTenant", () => EntitySchemaHelper.getSchema(LegacyTenant));
		const seedConnector3 = new MemoryEntityStorageConnector<LegacyTenant>({
			entitySchema: "LegacyTenant",
			partitionContextIds: ["node"],
			config: { storageKey: "tenant" }
		});
		await seedConnector3.setBatch([
			{
				id: TEST_TENANT_ID_A,
				apiKey: TEST_API_KEY_A,
				label: "Tenant A",
				dateCreated: new Date().toISOString(),
				dateModified: new Date().toISOString()
			},
			{
				id: TEST_TENANT_ID_B,
				apiKey: TEST_API_KEY_B,
				label: "Tenant B",
				dateCreated: new Date().toISOString(),
				dateModified: new Date().toISOString()
			}
		]);

		await run1?.shutdown();

		// Run 2: two tenants missing org IDs → auto-recovery doesn't apply, must throw.
		await expect(
			run({
				localesDirectory: LOCALES_DIR,
				stateStorage: new MemoryStateStorage(false, {
					nodeId: TEST_NODE_ID,
					nodeOrganizationId: TEST_ORG_ID
				}),
				disableProcessExitOnFailure: true,
				envVars: { ...BASE_ENV, TWIN_PORT: String(PORT_2) }
			})
		).rejects.toThrow();
	});
});
