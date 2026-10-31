// Copyright 2026 3Sixty Trade Ltd.
// SPDX-License-Identifier: Apache-2.0.

/**
 * The migration record of an organization a migrated user belonged to, still to be registered.
 */
export interface IOrganizationMigrationRecord {
	/**
	 * The kind of record.
	 */
	kind: "organization";

	/**
	 * The DID of the organization.
	 */
	organization: string;
}
