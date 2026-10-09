// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IEngineState } from "@3sixty/engine-models";

/**
 * The engine state for the node.
 */
export interface INodeEngineState extends IEngineState {
	/**
	 * The identity for the node.
	 */
	nodeId?: string;

	/**
	 * This is the default organization used in the context ids when a user is not authenticated.
	 * It is not used in multi-tenant mode, which gets the organization from the tenant table.
	 */
	nodeOrganizationId?: string;
}
