// Copyright 2026 3Sixty Trade Ltd.
// SPDX-License-Identifier: Apache-2.0.
import { splitLegacyProfile } from "../src/migration.js";

describe("splitLegacyProfile", () => {
	test("merges the profiles, the private one winning, and moves the supply chain properties", () => {
		expect(
			splitLegacyProfile({
				publicProfile: {
					"@context": "https://schema.org",
					"@type": "Organization",
					name: "Public Name",
					roles: ["buyer"],
					taxPin: "public-pin"
				},
				privateProfile: {
					"@context": "https://schema.org",
					"@type": "Organization",
					name: "Private Name",
					email: "office@example.com",
					taxPin: "private-pin",
					spatial: { "@type": "Place", name: "London" }
				}
			})
		).toEqual({
			merged: {
				"@context": "https://schema.org",
				"@type": "Organization",
				name: "Private Name",
				email: "office@example.com"
			},
			supplyChain: {
				"@context": "https://schema.org",
				"@type": "Organization",
				roles: ["buyer"],
				taxPin: "private-pin",
				spatial: { "@type": "Place", name: "London" }
			}
		});
	});

	test("writes no supply chain value without its properties, and nothing without profiles", () => {
		expect(
			splitLegacyProfile({
				publicProfile: { "@context": "https://schema.org", "@type": "Person", name: "Ada" }
			})
		).toEqual({
			merged: { "@context": "https://schema.org", "@type": "Person", name: "Ada" },
			supplyChain: undefined
		});
		expect(splitLegacyProfile({})).toEqual({});
		expect(
			splitLegacyProfile({
				privateProfile: { "@context": "https://schema.org", "@type": "Person", roles: ["seller"] }
			})
		).toEqual({
			merged: undefined,
			supplyChain: { "@context": "https://schema.org", "@type": "Person", roles: ["seller"] }
		});
	});
});
