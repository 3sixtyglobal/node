// Copyright 2026 3Sixty Trade Ltd.
// SPDX-License-Identifier: Apache-2.0.
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { TenantEventType, type IPlatformComponent } from "@3sixty/api-models";
import { ContextIdStore } from "@3sixty/context";
import { ComponentFactory } from "@3sixty/core";
import type { IEngineCore } from "@3sixty/engine-models";
import {
	EntityStorageConnectorFactory,
	type IEntityStorageConnector
} from "@3sixty/entity-storage-models";
import type { IMessagingAdminComponent } from "@3sixty/messaging-models";
import { loadMessagingTemplates, seedMessagingTemplates } from "../src/messagingTemplates.js";

describe("messagingTemplates", () => {
	let directory: string;

	beforeEach(async () => {
		directory = await mkdtemp(path.join(tmpdir(), "templates-"));
		await writeFile(
			path.join(directory, "password-reset.html"),
			"<html><head><title> Reset {{name}} </title></head><body>{{resetUrl}}</body></html>"
		);
		await writeFile(
			path.join(directory, "password-reset.de.html"),
			"<html><head><title>Passwort</title></head><body>{{resetUrl}}</body></html>"
		);
		await writeFile(path.join(directory, "notes.txt"), "ignored");
	});

	afterEach(async () => {
		await rm(directory, { recursive: true, force: true });
		ComponentFactory.clear();
		EntityStorageConnectorFactory.clear();
	});

	test("loads the default and locale templates with their titles", async () => {
		const templates = await loadMessagingTemplates(directory);

		expect(templates.map(t => [t.templateId, t.locale, t.title]).sort()).toEqual([
			["password-reset", "de", "Passwort"],
			["password-reset", "en", "Reset {{name}}"]
		]);
		expect(templates.find(t => t.locale === "en")?.content).toContain("{{resetUrl}}");
	});

	test("fails for a template without a title", async () => {
		await writeFile(path.join(directory, "broken.html"), "<html><body>x</body></html>");

		await expect(loadMessagingTemplates(directory)).rejects.toMatchObject({
			message: "node.messagingTemplateTitleMissing"
		});
	});

	test("stores only the missing templates for every tenant and new tenants", async () => {
		const stored = new Set<string>(["password-reset:de"]);
		EntityStorageConnectorFactory.register(
			"template-entry",
			() =>
				({
					get: vi.fn(async (id: string) => (stored.has(id) ? { id } : undefined))
				}) as unknown as IEntityStorageConnector
		);
		const admin = {
			setTemplate: vi.fn(async (templateId: string, locale: string) => {
				stored.add(`${templateId}:${locale}`);
			})
		};
		ComponentFactory.register(
			"messaging-admin",
			() => admin as unknown as IMessagingAdminComponent
		);
		let tenantCallback: ((tenantId: string, eventType: string) => Promise<void>) | undefined;
		const platform = {
			execute: vi.fn(async (method: () => Promise<void>) => method()),
			registerTenantEventCallback: vi.fn(
				(name: string, callback: (tenantId: string, eventType: string) => Promise<void>) => {
					tenantCallback = callback;
				}
			)
		};
		ComponentFactory.register("platform", () => platform as unknown as IPlatformComponent);
		const engineCore = {
			getContextIds: () => ({ node: "did:example:node" }),
			getRegisteredInstanceTypeOptional: () => "messaging-admin",
			getRegisteredInstanceType: () => "platform"
		} as unknown as IEngineCore;

		await seedMessagingTemplates(engineCore, directory);

		expect(admin.setTemplate).toHaveBeenCalledTimes(1);
		expect(admin.setTemplate).toHaveBeenCalledWith(
			"password-reset",
			"en",
			"Reset {{name}}",
			expect.stringContaining("{{resetUrl}}")
		);

		stored.clear();
		const contexts: unknown[] = [];
		vi.mocked(admin.setTemplate).mockImplementation(async () => {
			contexts.push(await ContextIdStore.getContextIds());
		});
		await tenantCallback?.("tenant-1", TenantEventType.Created);

		expect(admin.setTemplate).toHaveBeenCalledTimes(3);
		expect(contexts).toEqual([
			{ node: "did:example:node", tenant: "tenant-1" },
			{ node: "did:example:node", tenant: "tenant-1" }
		]);
	});

	test("ignores tenant events other than a new tenant", async () => {
		const admin = { setTemplate: vi.fn() };
		ComponentFactory.register(
			"messaging-admin",
			() => admin as unknown as IMessagingAdminComponent
		);
		EntityStorageConnectorFactory.register(
			"template-entry",
			() =>
				({
					get: vi.fn(async (id: string) => ({ id }))
				}) as unknown as IEntityStorageConnector
		);
		let tenantCallback: ((tenantId: string, eventType: string) => Promise<void>) | undefined;
		const platform = {
			execute: vi.fn(async (method: () => Promise<void>) => method()),
			registerTenantEventCallback: vi.fn(
				(name: string, callback: (tenantId: string, eventType: string) => Promise<void>) => {
					tenantCallback = callback;
				}
			)
		};
		ComponentFactory.register("platform", () => platform as unknown as IPlatformComponent);
		const engineCore = {
			getContextIds: () => ({ node: "did:example:node" }),
			getRegisteredInstanceTypeOptional: () => "messaging-admin",
			getRegisteredInstanceType: () => "platform"
		} as unknown as IEngineCore;

		await seedMessagingTemplates(engineCore, directory);
		await tenantCallback?.("tenant-1", TenantEventType.Updated);
		await tenantCallback?.("tenant-1", TenantEventType.Deleted);

		expect(platform.registerTenantEventCallback).toHaveBeenCalledWith(
			"seedMessagingTemplates",
			expect.any(Function)
		);
		expect(admin.setTemplate).not.toHaveBeenCalled();
	});

	test("does nothing without the node context or any templates", async () => {
		const platform = {
			execute: vi.fn(),
			registerTenantEventCallback: vi.fn()
		};
		ComponentFactory.register("platform", () => platform as unknown as IPlatformComponent);

		await seedMessagingTemplates(
			{
				getContextIds: () => undefined,
				getRegisteredInstanceTypeOptional: () => "messaging-admin",
				getRegisteredInstanceType: () => "platform"
			} as unknown as IEngineCore,
			directory
		);

		const emptyDirectory = await mkdtemp(path.join(tmpdir(), "templates-"));
		try {
			await writeFile(path.join(emptyDirectory, "notes.txt"), "ignored");
			await seedMessagingTemplates(
				{
					getContextIds: () => ({ node: "did:example:node" }),
					getRegisteredInstanceTypeOptional: () => "messaging-admin",
					getRegisteredInstanceType: () => "platform"
				} as unknown as IEngineCore,
				emptyDirectory
			);
		} finally {
			await rm(emptyDirectory, { recursive: true, force: true });
		}

		expect(platform.execute).not.toHaveBeenCalled();
		expect(platform.registerTenantEventCallback).not.toHaveBeenCalled();
	});

	test("does nothing without a directory or messaging admin", async () => {
		const engineCore = {
			getContextIds: () => ({ node: "did:example:node" }),
			getRegisteredInstanceTypeOptional: () => undefined
		} as unknown as IEngineCore;

		await expect(seedMessagingTemplates(engineCore, directory)).resolves.toBeUndefined();
		await expect(seedMessagingTemplates(engineCore, undefined)).resolves.toBeUndefined();
	});
});
