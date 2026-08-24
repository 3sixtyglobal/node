// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { ModuleProtocol } from "../src/models/moduleProtocol.js";
import {
	handleNpmProtocol,
	handleHttpsProtocol,
	getExtensionsCacheDir,
	initialiseLocales,
	fileExists,
	directoryExists,
	hashUrl
} from "../src/utils.js";

/**
 * E2E Tests for Protocol-Based Extension Loading (Download/Install Only)
 *
 * These tests use real npm registry and HTTPS CDN to verify download/install functionality.
 * They do NOT attempt to execute the downloaded modules as TWIN extensions.
 * They are slower and require network access, so they are in a separate file.
 */
const TEST_EXECUTION_DIR = "./tests";

describe("E2E Protocol-Based Extension Loading", () => {
	beforeAll(async () => {
		// Initialize I18n locales to avoid "Missing en" messages
		await initialiseLocales("locales");

		// Clean up any previous test artifacts
		try {
			await rm(getExtensionsCacheDir(TEST_EXECUTION_DIR, ModuleProtocol.Npm, ".tmp"), {
				recursive: true,
				force: true
			});
			await rm(getExtensionsCacheDir(TEST_EXECUTION_DIR, ModuleProtocol.Https, ".tmp"), {
				recursive: true,
				force: true
			});
		} catch {
			// Ignore errors if directories don't exist
		}
	});

	afterAll(async () => {
		// Clean up test artifacts after all tests
		try {
			await rm(getExtensionsCacheDir(TEST_EXECUTION_DIR, ModuleProtocol.Npm, ".tmp"), {
				recursive: true,
				force: true
			});
			await rm(getExtensionsCacheDir(TEST_EXECUTION_DIR, ModuleProtocol.Https, ".tmp"), {
				recursive: true,
				force: true
			});
		} catch {
			// Ignore errors
		}
	});

	test("should install npm package from real registry", async () => {
		// Using a small TWIN package
		const packageName = "@twin.org/nameof@0.0.2-next.19";

		const result = await handleNpmProtocol(packageName, TEST_EXECUTION_DIR);

		// Verify the result
		expect(result).toBeDefined();
		expect(result.resolvedPath).toBeDefined();
		expect(result.cached).toBe(false); // First time, not cached

		// Verify the file exists
		const exists = await fileExists(result.resolvedPath);
		expect(exists).toBe(true);
	});

	test("should cache npm package on second call", async () => {
		// Using a popular, tiny, stable package for reliable testing
		const packageName = "is-number@7.0.0";

		// First call (should install)
		const startTime1 = Date.now();
		const result1 = await handleNpmProtocol(packageName, TEST_EXECUTION_DIR);
		const duration1 = Date.now() - startTime1;

		expect(result1.cached).toBe(false);

		// Second call (should use cache)
		const startTime2 = Date.now();
		const result2 = await handleNpmProtocol(packageName, TEST_EXECUTION_DIR);
		const duration2 = Date.now() - startTime2;

		expect(result2.cached).toBe(true);
		expect(result2.resolvedPath).toBe(result1.resolvedPath);

		// Cached call should be significantly faster
		expect(duration2).toBeLessThan(duration1 / 2);
	});

	test("should download file from HTTPS URL", async () => {
		// Using a small file from jsDelivr CDN
		const url = "https://cdn.jsdelivr.net/npm/@twin.org/nameof@0.0.2-next.19/package.json";

		const result = await handleHttpsProtocol(url, TEST_EXECUTION_DIR, 10);

		// Verify the result
		expect(result).toBeDefined();
		expect(result.resolvedPath).toBeDefined();
		expect(result.cached).toBe(false); // First time, not cached

		// Verify the file exists
		const exists = await fileExists(result.resolvedPath);
		expect(exists).toBe(true);
	});

	test("should cache HTTPS download on second call", async () => {
		// Using a different file to ensure cache is empty
		const url = "https://cdn.jsdelivr.net/npm/is-number@7.0.0/package.json";

		// First call (should download)
		const result1 = await handleHttpsProtocol(url, TEST_EXECUTION_DIR, 10);

		expect(result1.cached).toBe(false);

		// Second call (should use cache)
		const result2 = await handleHttpsProtocol(url, TEST_EXECUTION_DIR, 10);

		expect(result2.cached).toBe(true);
		expect(result2.resolvedPath).toBe(result1.resolvedPath);
	});

	test("should respect size limit for HTTPS downloads", async () => {
		// Using a larger file to test size limit
		const url = "https://cdn.jsdelivr.net/npm/is-number@7.0.0/index.js";
		const maxSizeMb = 0.0001; // 100 bytes limit - file is much larger (several KB)

		// Should throw due to size limit
		await expect(async () => {
			await handleHttpsProtocol(url, TEST_EXECUTION_DIR, maxSizeMb);
		}).rejects.toThrow();
	});

	test("should handle npm package with scoped name", async () => {
		// Using a different scoped TWIN package
		const packageName = "@twin.org/nameof-transformer@0.0.2-next.14";

		const result = await handleNpmProtocol(packageName, TEST_EXECUTION_DIR);

		// Verify the result
		expect(result).toBeDefined();
		expect(result.resolvedPath).toBeDefined();
		expect(result.resolvedPath).toContain("@twin.org");
		expect(result.resolvedPath).toContain("nameof-transformer");

		// Verify the file exists
		const exists = await fileExists(result.resolvedPath);
		expect(exists).toBe(true);
	});

	test("should download, install, and import a real TWIN module", async () => {
		// Using @twin.org/nameof - we know it has nameofKebabCase export from code usage
		const packageName = "@twin.org/nameof@0.0.2-next.19";

		// 1. Download/install the package
		const result = await handleNpmProtocol(packageName, TEST_EXECUTION_DIR);

		// 2. Verify download succeeded
		expect(result).toBeDefined();
		expect(result.resolvedPath).toBeDefined();

		// Verify the file exists
		const fileExistsValue = await fileExists(result.resolvedPath);
		expect(fileExistsValue).toBe(true);

		// 3. Import the module (cross-platform path handling)
		const fileUrl =
			process.platform === "win32" ? `file://${result.resolvedPath}` : result.resolvedPath;

		// Dynamic import the module
		const importedModule = await import(fileUrl);

		// 4. Verify the module has expected exports
		expect(importedModule).toBeDefined();

		// Verify nameof function exists
		const nameofFn = importedModule.nameof;
		expect(nameofFn).toBeDefined();
		expect(typeof nameofFn).toBe("function");

		// Verify nameofKebabCase function exists
		const nameofKebabCaseFn = importedModule.nameofKebabCase;
		expect(nameofKebabCaseFn).toBeDefined();
		expect(typeof nameofKebabCaseFn).toBe("function");

		// 5. Verify the functions are callable and return expected types
		// Note: Without the transformer, nameof functions return error strings
		expect(typeof nameofFn()).toBe("string");
		expect(typeof nameofKebabCaseFn()).toBe("string");

		// Verify they contain the expected error message (transformer not in pipeline)
		expect(nameofFn()).toContain("nameof-transformer is not in the build pipeline");
		expect(nameofKebabCaseFn()).toContain("nameof-transformer is not in the build pipeline");
	});

	test.skip("should download and verify real TWIN extension with lifecycle hooks", async () => {
		const packageName = "@twin.org/dataspace-test-app@0.0.3-next.15";

		// 1. Download real TWIN extension
		const result = await handleNpmProtocol(packageName, TEST_EXECUTION_DIR);

		// 2. Verify download succeeded
		expect(result).toBeDefined();
		expect(result.resolvedPath).toBeDefined();
		expect(result.cached).toBe(false); // First time, not cached

		// Verify the file exists
		const fileExistsValue = await fileExists(result.resolvedPath);
		expect(fileExistsValue).toBe(true);

		// 3. Import the extension module (cross-platform path handling)
		const fileUrl =
			process.platform === "win32" ? `file://${result.resolvedPath}` : result.resolvedPath;

		// Dynamic import the extension module
		const extension = await import(fileUrl);

		// 4. Verify the extension has required lifecycle hooks
		expect(extension).toBeDefined();

		// Verify extensionInitialise function exists
		expect(extension.extensionInitialise).toBeDefined();
		expect(typeof extension.extensionInitialise).toBe("function");

		// Verify extensionInitialiseEngine function exists
		expect(extension.extensionInitialiseEngine).toBeDefined();
		expect(typeof extension.extensionInitialiseEngine).toBe("function");

		// Verify extensionInitialiseEngineServer function exists
		expect(extension.extensionInitialiseEngineServer).toBeDefined();
		expect(typeof extension.extensionInitialiseEngineServer).toBe("function");

		// 5. Verify function signatures (parameter count)
		expect(extension.extensionInitialise.length).toBe(2); // envVars, nodeEngineConfig
		expect(extension.extensionInitialiseEngine.length).toBe(1); // engineCore
		expect(extension.extensionInitialiseEngineServer.length).toBe(2); // engineCore, engineServer

		// 6. Verify additional extension-specific exports
		expect(extension.testAppInitialiser).toBeDefined();
		expect(typeof extension.testAppInitialiser).toBe("function");

		expect(extension.generateRestRoutes).toBeDefined();
		expect(typeof extension.generateRestRoutes).toBe("function");

		// 7. Verify this is a real extension
		expect(extension.TestDataspaceDataPlaneApp).toBeDefined();
		expect(typeof extension.TestDataspaceDataPlaneApp).toBe("function"); // Constructor function
	});

	test("should use custom cache directory when configured", async () => {
		const customCacheDir = ".tmp/custom-test-cache";
		const packageName = "is-number@7.0.0";

		try {
			// 1. Ensure custom cache directory doesn't exist initially
			const customCachePath = getExtensionsCacheDir(TEST_EXECUTION_DIR, "npm", customCacheDir);
			try {
				await rm(customCachePath, { recursive: true, force: true });
			} catch {
				// Ignore if doesn't exist
			}

			// 2. Download package to custom cache directory
			const result = await handleNpmProtocol(packageName, TEST_EXECUTION_DIR, customCacheDir);

			// 3. Verify the package was downloaded
			expect(result).toBeDefined();
			expect(result.resolvedPath).toBeDefined();

			// 4. Verify it was downloaded to the custom cache directory
			expect(result.resolvedPath).toContain(path.normalize(customCacheDir));
			expect(result.resolvedPath).toContain("extensions");
			expect(result.resolvedPath).toContain("npm");
			expect(result.resolvedPath).toContain("node_modules");

			// 5. Verify the custom cache directory structure exists
			// Extract the directory paths from the actual resolved path
			const resolvedDir = path.dirname(result.resolvedPath);
			const nodeModulesDir = path.dirname(resolvedDir);

			// Verify node_modules directory exists
			expect(await directoryExists(nodeModulesDir)).toBe(true);

			// 6. Verify the package directory exists
			expect(await directoryExists(resolvedDir)).toBe(true);

			// 7. Verify it's NOT in the default cache directory
			const defaultCachePath = getExtensionsCacheDir(
				TEST_EXECUTION_DIR,
				ModuleProtocol.Npm,
				".tmp"
			);
			const defaultNodeModulesPath = path.join(defaultCachePath, "node_modules", "is-number");
			expect(await directoryExists(defaultNodeModulesPath)).toBe(false);
		} finally {
			// Cleanup: Remove custom cache directory
			try {
				const customCachePath = getExtensionsCacheDir(TEST_EXECUTION_DIR, "npm", customCacheDir);
				await rm(customCachePath, { recursive: true, force: true });
			} catch {
				// Ignore cleanup errors
			}
		}
	});

	test("should use custom cache directory for HTTPS downloads", { retry: 2 }, async () => {
		const customCacheDir = ".tmp/custom-https-cache";
		const testUrl = "https://unpkg.com/is-number@7.0.0/index.js";
		const maxSizeMb = 10;

		try {
			// 1. Ensure custom cache directory doesn't exist initially
			const customCachePath = getExtensionsCacheDir(TEST_EXECUTION_DIR, "https", customCacheDir);
			try {
				await rm(customCachePath, { recursive: true, force: true });
			} catch {
				// Ignore if doesn't exist
			}

			// 2. Download file to custom cache directory
			const result = await handleHttpsProtocol(
				testUrl,
				TEST_EXECUTION_DIR,
				maxSizeMb,
				customCacheDir
			);

			// 3. Verify the file was downloaded
			expect(result).toBeDefined();
			expect(result.resolvedPath).toBeDefined();

			// 4. Verify it was downloaded to the custom cache directory
			expect(result.resolvedPath).toContain(path.normalize(customCacheDir));
			expect(result.resolvedPath).toContain("extensions");
			expect(result.resolvedPath).toContain("https");

			// 5. Verify the custom cache directory exists
			expect(await directoryExists(customCachePath)).toBe(true);

			// 6. Verify the file exists in the custom location
			expect(await fileExists(result.resolvedPath)).toBe(true);

			// 7. Verify it's NOT in the default cache directory
			const defaultCachePath = getExtensionsCacheDir(
				TEST_EXECUTION_DIR,
				ModuleProtocol.Https,
				".tmp"
			);
			// Check that the specific file doesn't exist in the default cache, not that the directory doesn't exist
			// (other tests might have created the default directory)
			const defaultFilePath = path.join(defaultCachePath, path.basename(result.resolvedPath));
			expect(await fileExists(defaultFilePath)).toBe(false);
		} finally {
			// Cleanup: Remove custom cache directory
			try {
				const customCachePath = getExtensionsCacheDir(TEST_EXECUTION_DIR, "https", customCacheDir);
				await rm(customCachePath, { recursive: true, force: true });
			} catch {
				// Ignore cleanup errors
			}
		}
	});

	test("should respect TTL and re-download expired cache", { retry: 2 }, async () => {
		const url = "https://unpkg.com/is-number@7.0.0/index.js";
		const executionDirectory = TEST_EXECUTION_DIR;

		// First download with very short TTL (0.001 hours = 3.6 seconds)
		const result1 = await handleHttpsProtocol(url, executionDirectory, 10, ".tmp", 0.001, false);
		expect(result1.cached).toBe(false);
		expect(await fileExists(result1.resolvedPath)).toBe(true);

		// Immediate second call should use cache (not expired yet)
		const result2 = await handleHttpsProtocol(url, executionDirectory, 10, ".tmp", 0.001, false);
		expect(result2.cached).toBe(true);
		expect(result2.resolvedPath).toBe(result1.resolvedPath);

		// Wait for cache to expire (4 seconds)
		await new Promise(resolve => setTimeout(resolve, 4000));

		// Third call should re-download (cache expired)
		const result3 = await handleHttpsProtocol(url, executionDirectory, 10, ".tmp", 0.001, false);
		expect(result3.cached).toBe(false);
		expect(result3.resolvedPath).toBe(result1.resolvedPath);
	});

	test("should force refresh regardless of TTL", { retry: 2 }, async () => {
		const url = "https://unpkg.com/is-number@7.0.0/package.json";
		const executionDirectory = TEST_EXECUTION_DIR;

		// First download
		const result1 = await handleHttpsProtocol(url, executionDirectory, 10, ".tmp", 24, false);
		expect(result1.cached).toBe(false);
		expect(await fileExists(result1.resolvedPath)).toBe(true);

		// Second call with force refresh should re-download
		const result2 = await handleHttpsProtocol(url, executionDirectory, 10, ".tmp", 24, true);
		expect(result2.cached).toBe(false);
		expect(result2.resolvedPath).toBe(result1.resolvedPath);

		// Third call without force refresh should use cache (TTL not expired)
		const result3 = await handleHttpsProtocol(url, executionDirectory, 10, ".tmp", 24, false);
		expect(result3.cached).toBe(true);
		expect(result3.resolvedPath).toBe(result1.resolvedPath);
	});

	test("should handle metadata file creation and reading", async () => {
		// Use unique URL to avoid cache conflicts with other tests
		const url = "https://cdn.jsdelivr.net/npm/lodash@4.17.21/package.json";
		const executionDirectory = TEST_EXECUTION_DIR;

		// Clean any existing cache for this URL first
		const cacheDir = getExtensionsCacheDir(executionDirectory, ModuleProtocol.Https, ".tmp");
		const filename = hashUrl(url);
		const cachedPath = path.join(cacheDir, filename);
		const metadataPath = `${cachedPath}.meta`;

		try {
			await rm(cachedPath, { force: true });
			await rm(metadataPath, { force: true });
		} catch {
			// Ignore cleanup errors
		}

		// Download file (should be fresh download)
		const result = await handleHttpsProtocol(url, executionDirectory, 10, ".tmp", 24, false);
		expect(result.cached).toBe(false);

		// Check that metadata file exists
		expect(await fileExists(metadataPath)).toBe(true);

		// Verify metadata content
		const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
		expect(metadata).toHaveProperty("downloadedAt");
		expect(metadata).toHaveProperty("url", url);
		expect(metadata).toHaveProperty("size");
		expect(typeof metadata.downloadedAt).toBe("number");
		expect(typeof metadata.size).toBe("number");
		expect(metadata.size).toBeGreaterThan(0);
	});

	test("should handle corrupted metadata gracefully", { retry: 2 }, async () => {
		// Use unique URL to avoid cache conflicts with other tests
		const url = "https://unpkg.com/lodash@4.17.21/LICENSE";
		const executionDirectory = TEST_EXECUTION_DIR;

		// Clean any existing cache for this URL first
		const cacheDir = getExtensionsCacheDir(executionDirectory, ModuleProtocol.Https, ".tmp");
		const filename = hashUrl(url);
		const cachedPath = path.join(cacheDir, filename);
		const metadataPath = `${cachedPath}.meta`;

		try {
			await rm(cachedPath, { force: true });
			await rm(metadataPath, { force: true });
		} catch {
			// Ignore cleanup errors
		}

		// First download (should be fresh)
		const result1 = await handleHttpsProtocol(url, executionDirectory, 10, ".tmp", 24, false);
		expect(result1.cached).toBe(false);

		// Corrupt the metadata file
		await writeFile(metadataPath, "invalid json content");

		// Second call should treat as expired and re-download
		const result2 = await handleHttpsProtocol(url, executionDirectory, 10, ".tmp", 24, false);
		expect(result2.cached).toBe(false);
		expect(result2.resolvedPath).toBe(result1.resolvedPath);

		// Verify metadata was recreated correctly
		const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
		expect(metadata).toHaveProperty("downloadedAt");
		expect(metadata).toHaveProperty("url", url);
		expect(metadata).toHaveProperty("size");
	});
});
