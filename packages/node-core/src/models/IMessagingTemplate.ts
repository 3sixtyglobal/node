// Copyright 2026 3Sixty Trade Ltd.
// SPDX-License-Identifier: Apache-2.0.

/**
 * A messaging template loaded from a file.
 */
export interface IMessagingTemplate {
	/**
	 * The id of the template.
	 */
	templateId: string;

	/**
	 * The locale of the template.
	 */
	locale: string;

	/**
	 * The title of the template.
	 */
	title: string;

	/**
	 * The content of the template.
	 */
	content: string;
}
