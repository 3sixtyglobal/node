// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type {
	AuditableItemGraphVertex,
	AuditableItemGraphVertexIndex,
	AuditableItemGraphVertexV1
} from "@twin.org/auditable-item-graph-service";
import { Converter, GeneralError, JsonHelper, ObjectHelper, StringHelper } from "@twin.org/core";
import { Blake2b } from "@twin.org/crypto";
import type { IEngineCore } from "@twin.org/engine-models";
import type { IEntitySchemaProperty } from "@twin.org/entity";
import {
	EntityStorageConnectorFactory,
	SchemaMigrationFactory,
	type IEntityStorageConnector,
	type ISchemaMigration
} from "@twin.org/entity-storage-models";
import { nameof } from "@twin.org/nameof";
import type {
	OdrlPolicy,
	OdrlPolicyIndex,
	OdrlPolicyV0
} from "@twin.org/rights-management-pap-service";
import { envBoolean } from "./envHelpers.js";
import type { IEnvironmentVariables } from "../../models/IEnvironmentVariables.js";

/**
 * Initialise schema migrations for the engine.
 * @param engineCore The engine core instance.
 * @param envVars The environment variables.
 */
export function initialiseMigrations(
	engineCore: IEngineCore,
	envVars: IEnvironmentVariables
): void {
	if (!envBoolean(envVars, "schemaMigrationEnabled", true)) {
		return;
	}

	migrationAigIndexes();
	migrationPapIndexes();
}

/**
 * Finalize schema migrations by clearing any temporary data stored in the shared store.
 * This should be called after all migrations have been processed to ensure that
 * any temporary data used during the migration process is removed.
 * @param engineCore The engine core instance.
 * @param envVars The environment variables.
 */
export async function finalizeMigrations(
	engineCore: IEngineCore,
	envVars: IEnvironmentVariables
): Promise<void> {
	// This is currently a placeholder for any finalization logic that might be needed
	// after all schema migrations have been processed.
}

/**
 * Perform migrations for Auditable Item Graph indexes.
 */
function migrationAigIndexes(): void {
	let aigIndexEntityStorage: IEntityStorageConnector<AuditableItemGraphVertexIndex> | undefined;

	const migrationAigV1V2: ISchemaMigration<AuditableItemGraphVertexV1, AuditableItemGraphVertex> = {
		removeEntityProperty: async (
			entity: AuditableItemGraphVertexV1,
			removedProperties: IEntitySchemaProperty<AuditableItemGraphVertexV1>[]
		): Promise<void> => {
			// If the aliasIndex is being removed we should migrate both aliasIndex and resourceTypeIndex
			// to the new index structure.
			if (removedProperties.find(prop => prop.property === "aliasIndex") === undefined) {
				return;
			}

			aigIndexEntityStorage ??= EntityStorageConnectorFactory.get<
				IEntityStorageConnector<AuditableItemGraphVertexIndex>
			>(StringHelper.kebabCase(nameof<AuditableItemGraphVertexIndex>()));

			const values: { type: string; value: string }[] = [
				{ type: "vertex", value: entity.id.toLowerCase() }
			];

			const aliases: string[] =
				entity.aliasIndex
					?.split("||")
					.map(alias => alias.trim())
					.filter(alias => alias.length > 0) ?? [];

			for (const alias of aliases) {
				values.push({ type: "alias", value: alias.toLowerCase() });
			}

			const resourceTypes: string[] =
				entity.resourceTypeIndex
					?.split("||")
					.map(resourceType => resourceType.trim())
					.filter(resourceType => resourceType.length > 0) ?? [];

			for (const resourceType of resourceTypes) {
				values.push({ type: "resourceType", value: resourceType.toLowerCase() });
			}

			// The context ids already contain the correct partition information for the indexes.
			const entries: AuditableItemGraphVertexIndex[] = values.map(({ type, value }) => ({
				id: indexRowId({ vertexId: entity.id, type, value }),
				vertexId: entity.id,
				type,
				value,
				dateCreated: entity.dateCreated,
				dateModified: entity.dateModified ?? entity.dateCreated
			}));

			await writeIndexEntries(aigIndexEntityStorage, entries, entity.id);
		}
	};
	SchemaMigrationFactory.register(
		`${nameof<AuditableItemGraphVertex>()}_1_2`,
		() => migrationAigV1V2 as ISchemaMigration
	);
}

/**
 * Perform migrations for Policy Administration Point indexes.
 */
function migrationPapIndexes(): void {
	let papIndexEntityStorage: IEntityStorageConnector<OdrlPolicyIndex> | undefined;

	const migrationPapV0V1: ISchemaMigration<OdrlPolicyV0, OdrlPolicy> = {
		removeEntityProperty: async (
			entity: OdrlPolicyV0,
			removedProperties: IEntitySchemaProperty<OdrlPolicyV0>[]
		): Promise<void> => {
			// If the assignerIndex is being removed we should migrate all four of the pipe delimited
			// indexes to the new index structure.
			if (removedProperties.find(prop => prop.property === "assignerIndex") === undefined) {
				return;
			}

			papIndexEntityStorage ??= EntityStorageConnectorFactory.get<
				IEntityStorageConnector<OdrlPolicyIndex>
			>(StringHelper.kebabCase(nameof<OdrlPolicyIndex>()));

			// An absent dimension contributes a single undefined value, otherwise it would collapse
			// the combinations to none and the policy would not be indexed at all.
			const assigners = splitPolicyIndex(entity.assignerIndex);
			const assignees = splitPolicyIndex(entity.assigneeIndex);
			const targets = splitPolicyIndex(entity.targetIndex);
			const actions = splitPolicyIndex(entity.actionIndex);

			// The entries are ordered by the creation date, so a policy stored before the date was
			// recorded is given the migration time rather than leaving the column empty.
			const dateCreated = entity.dateCreated ?? new Date(Date.now()).toISOString();

			// One entry per combination of assigner, assignee, target and action, which is what lets
			// a locator covering several of those fields be answered by a single lookup.
			const entries: OdrlPolicyIndex[] = [];
			for (const assigner of assigners) {
				for (const assignee of assignees) {
					for (const target of targets) {
						for (const action of actions) {
							entries.push({
								id: indexRowId({ policyId: entity.id, assigner, assignee, target, action }),
								policyId: entity.id,
								assigner,
								assignee,
								target,
								action,
								dateCreated
							});
						}
					}
				}
			}

			// The context ids already contain the correct partition information for the indexes.
			await writeIndexEntries(papIndexEntityStorage, entries, entity.id);
		}
	};
	SchemaMigrationFactory.register(
		`${nameof<OdrlPolicy>()}_0_1`,
		() => migrationPapV0V1 as ISchemaMigration
	);
}

/**
 * Split one of the pipe delimited indexes from a v0 policy into its index dimension values.
 * @param index The pipe delimited index value.
 * @returns The distinct case folded values, or a single undefined when there are none.
 */
function splitPolicyIndex(index: string | undefined): (string | undefined)[] {
	const values: string[] = [];

	for (const part of index?.split("|") ?? []) {
		// Index values are always stored case folded so lookups are case insensitive.
		const folded = part.trim().toLowerCase();
		if (folded.length > 0 && !values.includes(folded)) {
			values.push(folded);
		}
	}

	return values.length === 0 ? [undefined] : values;
}

/**
 * Build the id of an index row from the values which identify it, so a repeated migration
 * writes the same row instead of a duplicate.
 * @param identity The owner id and the index values of the row.
 * @returns The hex encoded hash.
 */
function indexRowId(identity: { [id: string]: string | undefined }): string {
	return Converter.bytesToHex(
		Blake2b.sum256(ObjectHelper.toBytes(JsonHelper.canonicalize(identity)))
	);
}

/**
 * Write the index rows of one entity, naming the entity when a row cannot be written.
 * @param indexEntityStorage The index storage to write to.
 * @param entries The rows to write.
 * @param id The id of the entity the rows belong to.
 */
async function writeIndexEntries<T>(
	indexEntityStorage: IEntityStorageConnector<T>,
	entries: T[],
	id: string
): Promise<void> {
	try {
		await indexEntityStorage.setBatch(entries);
	} catch (error) {
		throw new GeneralError("node", "migrationIndexWriteFailed", { id }, error);
	}
}
