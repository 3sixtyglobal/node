// Copyright 2026 3Sixty Trade Ltd.
// SPDX-License-Identifier: Apache-2.0.
import type { IFeatureDefinition } from "@3sixty/api-auth-models";
import type { IEnvironmentVariables } from "./IEnvironmentVariables.js";

/**
 * The type for the features method of an extension module.
 * This is called while the node is configured, to list the features the extension provides.
 * @param envVars The environment variables for the node.
 * @returns The features, each with the roles that can use it.
 */
export type NodeExtensionFeaturesMethod = (
	envVars: IEnvironmentVariables
) => Promise<IFeatureDefinition[]>;
