// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * The protocol types for modules.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const ModuleProtocol = {
	/**
	 * Local module (starts with . or / or file://).
	 */
	Local: "local",

	/**
	 * NPM package (starts with npm:).
	 */
	Npm: "npm",

	/**
	 * HTTPS URL (starts with https://).
	 */
	Https: "https",

	/**
	 * HTTP URL (starts with http://).
	 */
	Http: "http",

	/**
	 * Default/standard module resolution.
	 */
	Default: "default"
} as const;

/**
 * The protocol type for a module.
 */
export type ModuleProtocol = (typeof ModuleProtocol)[keyof typeof ModuleProtocol];
