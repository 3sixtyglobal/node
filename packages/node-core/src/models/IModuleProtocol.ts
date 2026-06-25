// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { ModuleProtocol } from "./moduleProtocol.js";

/**
 * The parsed module protocol information.
 */
export interface IModuleProtocol {
	/**
	 * The protocol type.
	 */
	protocol: ModuleProtocol;

	/**
	 * The identifier after the protocol (or the original if no protocol).
	 */
	identifier: string;

	/**
	 * The original module string.
	 */
	original: string;
}
