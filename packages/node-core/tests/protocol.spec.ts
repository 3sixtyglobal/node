// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { CLIDisplay } from "@twin.org/cli-core";
import { I18n, NativeModules } from "@twin.org/core";
import { ModuleProtocol } from "../src/models/moduleProtocol.js";
import {
	createModuleImportUrl,
	getExtensionsCacheDir,
	hashUrl,
	initialiseNativeModules,
	isCacheExpired,
	parseModuleProtocol
} from "../src/utils.js";

describe("Protocol Parsing Utilities", () => {
	describe("parseModuleProtocol", () => {
		test("should parse npm: protocol correctly", () => {
			const result = parseModuleProtocol("npm:@twin.org/identity-service");

			expect(result.protocol).toEqual(ModuleProtocol.Npm);
			expect(result.identifier).toEqual("@twin.org/identity-service");
			expect(result.original).toEqual("npm:@twin.org/identity-service");
		});

		test("should parse npm: protocol with scoped package", () => {
			const result = parseModuleProtocol("npm:@myorg/custom-extension");

			expect(result.protocol).toEqual(ModuleProtocol.Npm);
			expect(result.identifier).toEqual("@myorg/custom-extension");
			expect(result.original).toEqual("npm:@myorg/custom-extension");
		});

		test("should parse https: protocol correctly", () => {
			const result = parseModuleProtocol("https://example.com/module.js");

			expect(result.protocol).toEqual(ModuleProtocol.Https);
			expect(result.identifier).toEqual("https://example.com/module.js");
			expect(result.original).toEqual("https://example.com/module.js");
		});

		test("should parse http: protocol correctly", () => {
			const result = parseModuleProtocol("http://example.com/module.js");

			expect(result.protocol).toEqual(ModuleProtocol.Http);
			expect(result.identifier).toEqual("http://example.com/module.js");
			expect(result.original).toEqual("http://example.com/module.js");
		});

		test("should parse file: protocol as local correctly", () => {
			const result = parseModuleProtocol("file:///path/to/extension.js");

			expect(result.protocol).toEqual(ModuleProtocol.Local);
			expect(result.identifier).toEqual("file:///path/to/extension.js");
			expect(result.original).toEqual("file:///path/to/extension.js");
		});

		test("should parse local relative path correctly", () => {
			const result = parseModuleProtocol("./fixtures/myExtension.js");

			expect(result.protocol).toEqual(ModuleProtocol.Local);
			expect(result.identifier).toEqual("./fixtures/myExtension.js");
			expect(result.original).toEqual("./fixtures/myExtension.js");
		});

		test("should parse local absolute path correctly", () => {
			const result = parseModuleProtocol("/absolute/path/extension.js");

			expect(result.protocol).toEqual(ModuleProtocol.Local);
			expect(result.identifier).toEqual("/absolute/path/extension.js");
			expect(result.original).toEqual("/absolute/path/extension.js");
		});

		test("should parse default npm package correctly", () => {
			const result = parseModuleProtocol("@twin.org/identity-service");

			expect(result.protocol).toEqual(ModuleProtocol.Default);
			expect(result.identifier).toEqual("@twin.org/identity-service");
			expect(result.original).toEqual("@twin.org/identity-service");
		});

		test("should parse unscoped npm package as default", () => {
			const result = parseModuleProtocol("lodash");

			expect(result.protocol).toEqual(ModuleProtocol.Default);
			expect(result.identifier).toEqual("lodash");
			expect(result.original).toEqual("lodash");
		});

		test("should trim whitespace from module name", () => {
			const result = parseModuleProtocol("  npm:@twin.org/service  ");

			expect(result.protocol).toEqual(ModuleProtocol.Npm);
			expect(result.identifier).toEqual("@twin.org/service");
		});

		test("should handle module name with path after protocol", () => {
			const result = parseModuleProtocol("https://cdn.example.com/path/to/module.js?version=1.0.0");

			expect(result.protocol).toEqual(ModuleProtocol.Https);
			expect(result.identifier).toEqual("https://cdn.example.com/path/to/module.js?version=1.0.0");
		});
	});

	describe("hashUrl", () => {
		test("should generate consistent hash for same URL", () => {
			const url = "https://example.com/module.js";
			const hash1 = hashUrl(url);
			const hash2 = hashUrl(url);

			expect(hash1).toEqual(hash2);
			expect(hash1).toMatch(/^[\da-f]{64}\.js$/);
		});

		test("should generate different hashes for different URLs", () => {
			const hash1 = hashUrl("https://example.com/module1.js");
			const hash2 = hashUrl("https://example.com/module2.js");

			expect(hash1).not.toEqual(hash2);
		});

		test("should preserve file extension from URL", () => {
			const jsHash = hashUrl("https://example.com/module.js");
			const mjsHash = hashUrl("https://example.com/module.js");
			const tsHash = hashUrl("https://example.com/module.ts");

			expect(jsHash).toMatch(/\.js$/);
			expect(mjsHash).toMatch(/\.js$/);
			expect(tsHash).toMatch(/\.ts$/);
		});

		test("should handle URL without extension", () => {
			const hash = hashUrl("https://example.com/module");

			expect(hash).toMatch(/^[\da-f]{64}$/);
		});

		test("should handle URL with query parameters", () => {
			const hash = hashUrl("https://example.com/module.js?version=1.0.0");

			expect(hash).toMatch(/^[\da-f]{64}\.js$/);
		});

		test("should handle URL with hash fragment", () => {
			const hash = hashUrl("https://example.com/module.js#section");

			expect(hash).toMatch(/^[\da-f]{64}\.js$/);
		});
	});

	describe("initialiseNativeModules", () => {
		test("registers a working specifier so getModule resolves it", async () => {
			await initialiseNativeModules(["node:crypto"]);

			// eslint-disable-next-line @typescript-eslint/consistent-type-imports
			const nodeCrypto = NativeModules.getModule<typeof import("node:crypto")>("node:crypto");
			expect(nodeCrypto?.createHash).toBeTypeOf("function");
		});

		test("warns but does not throw for a specifier that fails to load", async () => {
			const warnSpy = vi.spyOn(CLIDisplay, "warning").mockImplementation(() => {});
			const formatSpy = vi.spyOn(I18n, "formatMessage");

			try {
				await initialiseNativeModules(["node:this-module-does-not-exist"]);

				expect(formatSpy).toHaveBeenCalledWith(
					"warn.node.nativeModuleUnavailable",
					expect.objectContaining({ specifier: "node:this-module-does-not-exist" })
				);
				expect(warnSpy).toHaveBeenCalledOnce();
				expect(NativeModules.getModule("node:this-module-does-not-exist")).toBeUndefined();
			} finally {
				warnSpy.mockRestore();
				formatSpy.mockRestore();
			}
		});
	});

	describe("getExtensionsCacheDir", () => {
		test("should generate correct path for npm protocol", () => {
			const cachePath = getExtensionsCacheDir("/home/user/project", ModuleProtocol.Npm, ".tmp");

			expect(cachePath).toContain(".tmp");
			expect(cachePath).toContain("extensions");
			expect(cachePath).toContain(ModuleProtocol.Npm);
			expect(cachePath).toMatch(/[/\\]\.tmp[/\\]extensions[/\\]npm$/);
		});

		test("should generate correct path for https protocol", () => {
			const cachePath = getExtensionsCacheDir("/home/user/project", ModuleProtocol.Https, ".tmp");

			expect(cachePath).toContain(".tmp");
			expect(cachePath).toContain("extensions");
			expect(cachePath).toContain(ModuleProtocol.Https);
			expect(cachePath).toMatch(/[/\\]\.tmp[/\\]extensions[/\\]https$/);
		});

		test("should generate correct path for local protocol", () => {
			const cachePath = getExtensionsCacheDir("/home/user/project", ModuleProtocol.Local, ".tmp");

			expect(cachePath).toContain(".tmp");
			expect(cachePath).toContain("extensions");
			expect(cachePath).toContain(ModuleProtocol.Local);
		});

		test("should use execution directory as base", () => {
			const execDir = "/custom/execution/dir";
			const resultPath = getExtensionsCacheDir(execDir, ModuleProtocol.Npm, ".tmp");

			// Normalize path separators for cross-platform comparison
			const normalizedResult = resultPath.replace(/\\/g, "/");
			const normalizedExecDir = execDir.replace(/\\/g, "/");

			expect(normalizedResult).toContain(normalizedExecDir);
		});

		test("should work with Windows-style paths", () => {
			const cachePath = getExtensionsCacheDir(
				"C:\\Users\\user\\project",
				ModuleProtocol.Npm,
				".tmp"
			);

			expect(cachePath).toContain(".tmp");
			expect(cachePath).toContain("extensions");
			expect(cachePath).toContain(ModuleProtocol.Npm);
		});

		test("should use custom cache directory when provided", () => {
			const cachePath = getExtensionsCacheDir("/home/user/project", ModuleProtocol.Npm, "cache");

			expect(cachePath).toContain("cache");
			expect(cachePath).toContain("extensions");
			expect(cachePath).toContain(ModuleProtocol.Npm);
			expect(cachePath).not.toContain(".tmp");
			expect(cachePath).toMatch(/[/\\]cache[/\\]extensions[/\\]npm$/);
		});

		test("should use default .tmp when custom directory is undefined", () => {
			const cachePath = getExtensionsCacheDir("/home/user/project", ModuleProtocol.Npm, undefined);

			expect(cachePath).toContain(".tmp");
			expect(cachePath).toContain("extensions");
			expect(cachePath).toContain(ModuleProtocol.Npm);
			expect(cachePath).toMatch(/[/\\]\.tmp[/\\]extensions[/\\]npm$/);
		});

		test("should work with absolute custom cache directory", () => {
			const customDir = "/var/cache/twin-node";
			const cachePath = getExtensionsCacheDir(
				"/home/user/project",
				ModuleProtocol.Https,
				customDir
			);

			expect(cachePath).toContain("extensions");
			expect(cachePath).toContain(ModuleProtocol.Https);
			expect(cachePath).toMatch(/[/\\]var[/\\]cache[/\\]twin-node[/\\]extensions[/\\]https$/);
		});
	});

	describe("isCacheExpired", () => {
		test("should return true when forceRefresh is true", async () => {
			const result = await isCacheExpired("/fake/path.meta", 24, true);
			expect(result).toBe(true);
		});

		test("should return true when metadata file doesn't exist", async () => {
			const result = await isCacheExpired("/nonexistent/path.meta", 24, false);
			expect(result).toBe(true);
		});

		test("should return false when cache is not expired", async () => {
			const tempDir = await mkdtemp(path.join(tmpdir(), "cache-test-"));
			const metadataPath = path.join(tempDir, "test.meta");
			const twelveHoursMillis = 12 * 60 * 60 * 1000;

			// Create metadata with recent timestamp (not expired)
			const metadata = {
				downloadedAt: Date.now() - twelveHoursMillis, // 12 hours ago
				url: "https://example.com/test.js",
				size: 1024
			};
			await writeFile(metadataPath, JSON.stringify(metadata));

			const result = await isCacheExpired(metadataPath, 24, false); // TTL 24 hours
			expect(result).toBe(false);

			// Cleanup
			await rm(tempDir, { recursive: true, force: true });
		});

		test("should return true when cache is expired", async () => {
			const tempDir = await mkdtemp(path.join(tmpdir(), "cache-test-"));
			const metadataPath = path.join(tempDir, "test.meta");
			const twoDaysMillis = 48 * 60 * 60 * 1000;
			// Create metadata with old timestamp (expired)
			const metadata = {
				downloadedAt: Date.now() - twoDaysMillis, // 48 hours ago
				url: "https://example.com/test.js",
				size: 1024
			};
			await writeFile(metadataPath, JSON.stringify(metadata));

			const result = await isCacheExpired(metadataPath, 24, false); // TTL 24 hours
			expect(result).toBe(true);

			// Cleanup
			await rm(tempDir, { recursive: true, force: true });
		});

		test("should return true when metadata is corrupted", async () => {
			const tempDir = await mkdtemp(path.join(tmpdir(), "cache-test-"));
			const metadataPath = path.join(tempDir, "test.meta");

			// Create corrupted metadata
			await writeFile(metadataPath, "invalid json content");

			const result = await isCacheExpired(metadataPath, 24, false);
			expect(result).toBe(true);

			// Cleanup
			await rm(tempDir, { recursive: true, force: true });
		});

		test("should handle edge case with TTL of 0", async () => {
			const tempDir = await mkdtemp(path.join(tmpdir(), "cache-test-"));
			const metadataPath = path.join(tempDir, "test.meta");

			// Create metadata with any timestamp
			const metadata = {
				downloadedAt: Date.now() - 1000, // 1 second ago
				url: "https://example.com/test.js",
				size: 1024
			};
			await writeFile(metadataPath, JSON.stringify(metadata));

			const result = await isCacheExpired(metadataPath, 0, false); // TTL 0 hours
			expect(result).toBe(true); // Should always be expired with TTL 0

			// Cleanup
			await rm(tempDir, { recursive: true, force: true });
		});
	});

	describe("createModuleImportUrl", () => {
		test("should create correct import URL for Windows platform", () => {
			// Mock Windows platform
			const originalPlatform = process.platform;
			Object.defineProperty(process, "platform", {
				value: "win32"
			});

			const filePath = "C:\\Users\\user\\project\\module.js";
			const result = createModuleImportUrl(filePath);

			expect(result).toEqual(`file://${filePath}`);

			// Restore original platform
			Object.defineProperty(process, "platform", {
				value: originalPlatform
			});
		});

		test("should create correct import URL for non-Windows platforms", () => {
			// Mock non-Windows platform
			const originalPlatform = process.platform;
			Object.defineProperty(process, "platform", {
				value: "linux"
			});

			const filePath = "/home/user/project/module.js";
			const result = createModuleImportUrl(filePath);

			expect(result).toEqual(filePath);

			// Restore original platform
			Object.defineProperty(process, "platform", {
				value: originalPlatform
			});
		});

		test("should handle absolute paths correctly", () => {
			const originalPlatform = process.platform;

			// Test Windows absolute path
			Object.defineProperty(process, "platform", {
				value: "win32"
			});

			const windowsPath = "C:\\Program Files\\Node\\module.js";
			const windowsResult = createModuleImportUrl(windowsPath);
			expect(windowsResult).toEqual(`file://${windowsPath}`);

			// Test Unix absolute path
			Object.defineProperty(process, "platform", {
				value: "darwin"
			});

			const unixPath = "/usr/local/lib/node_modules/module.js";
			const unixResult = createModuleImportUrl(unixPath);
			expect(unixResult).toEqual(unixPath);

			// Restore original platform
			Object.defineProperty(process, "platform", {
				value: originalPlatform
			});
		});
	});
});
