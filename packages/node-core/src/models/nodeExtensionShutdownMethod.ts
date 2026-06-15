// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * The type for the shutdown method of an extension module.
 * This is called when the engine is shutting down.
 * @returns A promise that resolves when the extension shutdown is complete.
 */
export type NodeExtensionShutdownMethod = () => Promise<void>;
