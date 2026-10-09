// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IEngineCore } from "@3sixty/engine-models";

/**
 * The type for the initialise engine method of an extension module.
 * This is called when the engine has been constructed but not yet started.
 * @param engineCore The engine core instance.
 * @returns A promise that resolves when the extension engine initialisation is complete.
 */
export type NodeExtensionInitialiseEngineMethod = (engineCore: IEngineCore) => Promise<void>;
