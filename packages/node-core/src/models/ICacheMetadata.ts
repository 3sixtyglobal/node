// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Metadata for cached HTTPS extensions.
 */
export interface ICacheMetadata {
	/**
	 * Timestamp when the file was downloaded.
	 */
	downloadedAt: number;

	/**
	 * Original URL of the cached file.
	 */
	url: string;

	/**
	 * Size of the cached file in bytes.
	 */
	size: number;
}
