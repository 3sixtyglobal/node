// Copyright 2026 IOTA Stiftung.
// Copyright 2026 3Sixty Trade Ltd.
// SPDX-License-Identifier: Apache-2.0.
import type { IStepDefinition } from "./IStepDefinition.js";

/**
 * A named group of steps that are executed sequentially.
 */
export interface IGroupDefinition {
	/**
	 * Display name for the group, shown in console output.
	 */
	group: string;

	/**
	 * Ordered list of steps to run within the group.
	 */
	steps: IStepDefinition[];
}
