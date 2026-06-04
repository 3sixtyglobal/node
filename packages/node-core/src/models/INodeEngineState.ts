// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IEngineState } from "@twin.org/engine-models";

/**
 * The engine state for the node.
 */
export interface INodeEngineState extends IEngineState {
	/**
	 * The identity for the node.
	 */
	nodeId?: string;
}
