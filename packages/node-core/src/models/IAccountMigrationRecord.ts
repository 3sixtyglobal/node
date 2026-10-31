// Copyright 2026 3Sixty Trade Ltd.
// SPDX-License-Identifier: Apache-2.0.

/**
 * The migration record of a user, keyed by e-mail so a repeated run keeps its account id.
 */
export interface IAccountMigrationRecord {
	/**
	 * The kind of record.
	 */
	kind: "account";

	/**
	 * The e-mail address of the user.
	 */
	email: string;

	/**
	 * The account id of the user.
	 */
	accountId: string;

	/**
	 * The roles from the v0 scope still to be assigned to the account.
	 */
	roles?: string[];

	/**
	 * The organization still to issue a membership credential for.
	 */
	organization?: string;
}
