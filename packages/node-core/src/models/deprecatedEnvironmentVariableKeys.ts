// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * The camelCase property names which are no longer used, mapped to the keys which replace them.
 * They are still recognised so an existing configuration does not fail validation, but each one
 * reports a deprecation warning and has no effect on the engine configuration.
 * An empty array is a key which has been withdrawn with nothing to replace it. The OAuth redirect
 * addresses are the exception, still read under the names they had before, TWIN_AUTH_O_AUTH_...
 */
export const DEPRECATED_ENVIRONMENT_VARIABLE_KEYS: ReadonlyMap<string, readonly string[]> = new Map(
	[
		[
			"messagingEnabled",
			["messagingEmailConnector", "messagingSmsConnector", "messagingPushNotificationConnector"]
		],
		["dataProcessingEnabled", ["dataConverterConnectors", "dataExtractorConnectors"]],
		["authOAuthSuccessRedirectUrl", ["authOauthSuccessRedirectUrl"]],
		["authOAuthFailureRedirectUrl", ["authOauthFailureRedirectUrl"]]
	]
);
