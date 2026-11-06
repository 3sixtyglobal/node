// Copyright 2026 3Sixty Trade Ltd.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Environment variables the engine server still reads under the names they had before.
 */
export interface IEngineServerDeprecatedEnvironmentVariables {
	/**
	 * The earlier name of authOauthSuccessRedirectUrl, TWIN_AUTH_O_AUTH_SUCCESS_REDIRECT_URL, read when it is not set.
	 */
	authOAuthSuccessRedirectUrl?: string;

	/**
	 * The earlier name of authOauthFailureRedirectUrl, TWIN_AUTH_O_AUTH_FAILURE_REDIRECT_URL, read when it is not set.
	 */
	authOAuthFailureRedirectUrl?: string;
}
