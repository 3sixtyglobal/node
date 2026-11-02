// Copyright 2026 3Sixty Trade Ltd.
// SPDX-License-Identifier: Apache-2.0.

/**
 * The migration record of a DID whose roles move to the accounts of the users that held it.
 */
export interface IIdentityMigrationRecord {
	/**
	 * The kind of record.
	 */
	kind: "identity";

	/**
	 * The DID the roles are assigned to.
	 */
	identity: string;

	/**
	 * The accounts of the users that held the DID.
	 */
	accountIds: string[];
}
