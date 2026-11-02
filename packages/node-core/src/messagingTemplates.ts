// Copyright 2026 3Sixty Trade Ltd.
// SPDX-License-Identifier: Apache-2.0.
import path from "node:path";
import { TenantEventType, type IPlatformComponent } from "@3sixty/api-models";
import { ContextIdKeys, ContextIdStore, type IContextIds } from "@3sixty/context";
import { ComponentFactory, GeneralError, Is, StringHelper } from "@3sixty/core";
import type { IEngineCore } from "@3sixty/engine-models";
import {
	EntityStorageConnectorFactory,
	type IEntityStorageConnector
} from "@3sixty/entity-storage-models";
import type { IMessagingAdminComponent } from "@3sixty/messaging-models";
import type { TemplateEntry } from "@3sixty/messaging-service";
import { nameof } from "@3sixty/nameof";
import { DEFAULT_MESSAGING_TEMPLATE_LOCALE } from "./defaults.js";
import type { IMessagingTemplate } from "./models/IMessagingTemplate.js";
import { getFiles, loadTextFile } from "./utils.js";

/**
 * Load the messaging templates from a directory, &lt;template-id&gt;.html for the default locale and
 * &lt;template-id&gt;.&lt;locale&gt;.html for a locale, the title is taken from the title element.
 * @param directory The directory holding the templates.
 * @returns The templates.
 * @throws GeneralError when a template has no title.
 */
export async function loadMessagingTemplates(directory: string): Promise<IMessagingTemplate[]> {
	const templates: IMessagingTemplate[] = [];
	const files = (await getFiles(directory)).filter(file => file.toLowerCase().endsWith(".html"));
	for (const file of files) {
		const name = path.basename(file).slice(0, -".html".length);
		const localeIndex = name.lastIndexOf(".");
		const content = await loadTextFile(file);
		const title = /<title>([\s\S]*?)<\/title>/i.exec(content)?.[1]?.trim();
		if (!Is.stringValue(title)) {
			throw new GeneralError("node", "messagingTemplateTitleMissing", { file });
		}
		templates.push({
			templateId: localeIndex > 0 ? name.slice(0, localeIndex) : name,
			locale: localeIndex > 0 ? name.slice(localeIndex + 1) : DEFAULT_MESSAGING_TEMPLATE_LOCALE,
			title,
			content
		});
	}
	return templates;
}

/**
 * Store the messaging templates from a directory in every tenant that does not have them yet, and
 * in each tenant created later.
 * @param engineCore The running engine core.
 * @param directory The directory holding the templates.
 * @returns A promise that resolves when the templates have been stored.
 */
export async function seedMessagingTemplates(
	engineCore: IEngineCore,
	directory: string | undefined
): Promise<void> {
	const nodeContextIds = engineCore.getContextIds() ?? {};
	const messagingAdminType =
		engineCore.getRegisteredInstanceTypeOptional("messagingAdminComponent");
	if (
		!Is.stringValue(directory) ||
		!Is.stringValue(nodeContextIds[ContextIdKeys.Node]) ||
		!Is.stringValue(messagingAdminType)
	) {
		return;
	}

	const templates = await loadMessagingTemplates(directory);
	if (!Is.arrayValue(templates)) {
		return;
	}

	const messagingAdmin = ComponentFactory.get<IMessagingAdminComponent>(messagingAdminType);
	const platformComponent = ComponentFactory.get<IPlatformComponent>(
		engineCore.getRegisteredInstanceType("platformComponent")
	);

	await ContextIdStore.run(nodeContextIds, async () => {
		await platformComponent.execute(async () => {
			await storeMissingTemplates(messagingAdmin, templates);
		});
	});

	platformComponent.registerTenantEventCallback(
		"seedMessagingTemplates",
		async (tenantId, eventType) => {
			if (eventType === TenantEventType.Created) {
				const contextIds: IContextIds = { ...nodeContextIds, [ContextIdKeys.Tenant]: tenantId };
				await ContextIdStore.run(contextIds, async () => {
					await storeMissingTemplates(messagingAdmin, templates);
				});
			}
		}
	);
}

/**
 * Store the templates the current tenant does not have yet.
 * @param messagingAdmin The messaging admin component.
 * @param templates The templates.
 * @returns A promise that resolves when the templates have been stored.
 */
async function storeMissingTemplates(
	messagingAdmin: IMessagingAdminComponent,
	templates: IMessagingTemplate[]
): Promise<void> {
	// Read the stored entry directly, as getTemplate falls back to the default locale.
	const storage = EntityStorageConnectorFactory.get<IEntityStorageConnector<TemplateEntry>>(
		StringHelper.kebabCase(nameof<TemplateEntry>())
	);
	for (const template of templates) {
		const existing = await storage.get(`${template.templateId}:${template.locale}`);
		if (Is.empty(existing)) {
			await messagingAdmin.setTemplate(
				template.templateId,
				template.locale,
				template.title,
				template.content
			);
		}
	}
}
