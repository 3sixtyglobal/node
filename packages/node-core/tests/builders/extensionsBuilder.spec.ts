// Copyright 2026 3Sixty Trade Ltd.
// SPDX-License-Identifier: Apache-2.0.
import path from "node:path";
import { FeatureFactory } from "@3sixty/api-auth-models";
import { FeatureComponentType } from "@3sixty/engine-server-types";
import { extensionsConfiguration } from "../../src/builders/extensionsBuilder.js";
import type { INodeEngineConfig } from "../../src/models/INodeEngineConfig.js";

const FEATURES_EXTENSION = path.resolve("./tests/fixtures/featuresExtension.js");
const PLAIN_EXTENSION = path.resolve("./tests/fixtures/myExtension.js");

/**
 * Create a node engine config, with a feature component when asked.
 * @param withFeatureComponent Whether to add a feature component.
 * @returns The config.
 */
function createConfig(withFeatureComponent: boolean): INodeEngineConfig {
	return {
		types: {
			featureComponent: withFeatureComponent
				? [
						{
							type: FeatureComponentType.Service,
							options: { config: { authorizationModelId: "system" } }
						}
					]
				: undefined
		}
	};
}

describe("extensionsConfiguration", () => {
	afterEach(() => {
		for (const name of FeatureFactory.names()) {
			FeatureFactory.unregister(name);
		}
	});

	test("registers the features of the extensions with the feature factory", async () => {
		await extensionsConfiguration(
			{ extensions: `${PLAIN_EXTENSION},${FEATURES_EXTENSION}` },
			createConfig(true)
		);

		expect(FeatureFactory.names()).toEqual(["supply-chain", "reports"]);
		expect(FeatureFactory.get("supply-chain")).toEqual({
			name: "supply-chain",
			roles: ["user"],
			config: { title: "Supply chain" }
		});
		expect(FeatureFactory.get("reports")).toEqual({ name: "reports", roles: ["global-admin"] });
	});

	test("leaves the feature component config alone", async () => {
		const config = await extensionsConfiguration(
			{ extensions: FEATURES_EXTENSION },
			createConfig(true)
		);

		expect(config.types.featureComponent?.[0].options).toEqual({
			config: { authorizationModelId: "system" }
		});
	});

	test("registers nothing when no extension provides features", async () => {
		const config = await extensionsConfiguration(
			{ extensions: PLAIN_EXTENSION },
			createConfig(false)
		);

		expect(FeatureFactory.names()).toEqual([]);
		expect(config.types.featureComponent).toBeUndefined();
	});

	test("can configure the extensions again in the same process", async () => {
		await extensionsConfiguration({ extensions: FEATURES_EXTENSION }, createConfig(true));
		await extensionsConfiguration({ extensions: FEATURES_EXTENSION }, createConfig(true));

		expect(FeatureFactory.names()).toEqual(["supply-chain", "reports"]);
	});

	test("fails when two extensions provide the same feature", async () => {
		await expect(
			extensionsConfiguration(
				{ extensions: `${FEATURES_EXTENSION},${FEATURES_EXTENSION}` },
				createConfig(true)
			)
		).rejects.toMatchObject({
			name: "GeneralError",
			message: "node.extensionLoadingError",
			properties: { extension: FEATURES_EXTENSION },
			cause: {
				message: "node.extensionFeatureDuplicate",
				properties: { extension: FEATURES_EXTENSION, feature: "supply-chain" }
			}
		});
		expect(FeatureFactory.names()).toEqual([]);
	});

	test("fails when there is no feature component to list the features", async () => {
		await expect(
			extensionsConfiguration({ extensions: FEATURES_EXTENSION }, createConfig(false))
		).rejects.toMatchObject({
			name: "GeneralError",
			message: "node.extensionFeaturesUnavailable",
			properties: { features: "supply-chain, reports" }
		});
		expect(FeatureFactory.names()).toEqual([]);
	});
});
