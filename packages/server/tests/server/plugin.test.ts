import { expect, test, describe } from "bun:test";
import {
	createMockServer,
	createPlugin,
	plugin,
	PluginManager,
	json,
	text,
} from "../../src/index.ts";

describe("Plugin System", () => {
	describe("PluginManager", () => {
		test("should create and manage plugins", () => {
			const app = createMockServer();
			const manager = new PluginManager(app, app.router);
			expect(manager).toBeDefined();
			expect(manager.getPlugins()).toHaveLength(0);
		});

		test("should register plugins", async () => {
			const app = createMockServer();
			const testPlugin = createPlugin(
				{ name: "test-plugin", version: "1.0.0" },
				async (context) => {
					context.log("Test plugin registered");
				},
			);

			await app.register(testPlugin);

			expect(app.plugins.hasPlugin("test-plugin")).toBe(true);
			expect(app.plugins.getPlugins()).toHaveLength(1);
		});

		test("should prevent duplicate plugin registration", async () => {
			const app = createMockServer();
			const testPlugin = createPlugin(
				{ name: "duplicate-test", version: "1.0.0" },
				async () => {},
			);

			await app.register(testPlugin);

			await expect(app.register(testPlugin)).rejects.toThrow(
				"Plugin 'duplicate-test' is already registered",
			);
		});

		test("should validate plugin dependencies", async () => {
			const app = createMockServer();
			const dependentPlugin = createPlugin(
				{
					name: "dependent-plugin",
					version: "1.0.0",
					dependencies: ["missing-dependency"],
				},
				async () => {},
			);

			await expect(app.register(dependentPlugin)).rejects.toThrow(
				"Plugin 'dependent-plugin' depends on 'missing-dependency' which is not registered",
			);
		});

		test("should handle plugin dependencies correctly", async () => {
			const app = createMockServer();
			const basePlugin = createPlugin(
				{ name: "base-plugin", version: "1.0.0" },
				async () => {},
			);

			const dependentPlugin = createPlugin(
				{
					name: "dependent-plugin",
					version: "1.0.0",
					dependencies: ["base-plugin"],
				},
				async () => {},
			);

			await app.register(basePlugin);
			await app.register(dependentPlugin);

			expect(app.plugins.hasPlugin("base-plugin")).toBe(true);
			expect(app.plugins.hasPlugin("dependent-plugin")).toBe(true);
		});
	});

	describe("Plugin Lifecycle", () => {
		test("should execute lifecycle hooks in correct order", async () => {
			const app = createMockServer();
			const hookOrder: string[] = [];

			const lifecyclePlugin = createPlugin(
				{ name: "lifecycle-test", version: "1.0.0" },
				async (context) => {
					hookOrder.push("register");
				},
				{
					beforeRegister: async () => {
						hookOrder.push("beforeRegister");
					},
					afterRegister: async () => {
						hookOrder.push("afterRegister");
					},
					beforeStart: async () => {
						hookOrder.push("beforeStart");
					},
					afterStart: async () => {
						hookOrder.push("afterStart");
					},
					beforeStop: async () => {
						hookOrder.push("beforeStop");
					},
					afterStop: async () => {
						hookOrder.push("afterStop");
					},
				},
			);

			await app.register(lifecyclePlugin);
			await app.startPlugins();
			await app.stopPlugins();

			expect(hookOrder).toEqual([
				"beforeRegister",
				"register",
				"afterRegister",
				"beforeStart",
				"afterStart",
				"beforeStop",
				"afterStop",
			]);
		});

		test("should handle async lifecycle hooks", async () => {
			const app = createMockServer();
			let asyncTestValue = "";

			const asyncPlugin = createPlugin(
				{ name: "async-test", version: "1.0.0" },
				async () => {
					await new Promise((resolve) => setTimeout(resolve, 10));
					asyncTestValue = "registered";
				},
				{
					beforeStart: async () => {
						await new Promise((resolve) => setTimeout(resolve, 10));
						asyncTestValue += "-started";
					},
				},
			);

			await app.register(asyncPlugin);
			await app.startPlugins();

			expect(asyncTestValue).toBe("registered-started");
		});
	});

	describe("Plugin Context", () => {
		test("should provide correct context to plugins", async () => {
			const app = createMockServer();
			let capturedContext: any;

			const contextPlugin = createPlugin(
				{ name: "context-test", version: "1.0.0" },
				async (context) => {
					capturedContext = context;
				},
			);

			await app.register(contextPlugin);

			expect(capturedContext).toBeDefined();
			expect(capturedContext.plugin.name).toBe("context-test");
			expect(capturedContext.server).toBeDefined();
			expect(capturedContext.router).toBeDefined();
			expect(capturedContext.log).toBeFunction();
			expect(capturedContext.addRoute).toBeFunction();
			expect(capturedContext.addMiddleware).toBeFunction();
			expect(capturedContext.registerService).toBeFunction();
			expect(capturedContext.getService).toBeFunction();
			expect(capturedContext.storage).toBeInstanceOf(Map);
		});

		test("should allow plugins to register routes", async () => {
			const app = createMockServer();
			const routePlugin = createPlugin(
				{ name: "route-test", version: "1.0.0" },
				async (context) => {
					context.addRoute("GET", "/plugin-route", async () => {
						return text("Plugin route response");
					});
				},
			);

			await app.register(routePlugin);

			const response = await app.request.get("/plugin-route");
			expect(response.status).toBe(200);
			expect(await response.text()).toBe("Plugin route response");
		});

		test("should allow plugins to register middleware", async () => {
			const app = createMockServer();
			let middlewareCalled = false;

			const middlewarePlugin = createPlugin(
				{ name: "middleware-test", version: "1.0.0" },
				async (context) => {
					context.addMiddleware(async (req, next) => {
						middlewareCalled = true;
						return next();
					});
				},
			);

			await app.register(middlewarePlugin);
			app.get("/test", () => text("Test"));

			await app.request.get("/test");
			expect(middlewareCalled).toBe(true);
		});

		test("should support plugin-scoped storage", async () => {
			const app = createMockServer();
			const storagePlugin = createPlugin(
				{ name: "storage-test", version: "1.0.0" },
				async (context) => {
					context.storage.set("testKey", "testValue");

					context.addRoute("GET", "/storage-test", async () => {
						return text(context.storage.get("testKey") || "not found");
					});
				},
			);

			await app.register(storagePlugin);

			const response = await app.request.get("/storage-test");
			expect(await response.text()).toBe("testValue");
		});
	});

	describe("Plugin Services", () => {
		test("should allow plugins to register and consume services", async () => {
			const app = createMockServer();
			const serviceProviderPlugin = createPlugin(
				{ name: "service-provider", version: "1.0.0" },
				async (context) => {
					context.registerService("calculator", {
						add: (a: number, b: number) => a + b,
						multiply: (a: number, b: number) => a * b,
					});
				},
			);

			const serviceConsumerPlugin = createPlugin(
				{ name: "service-consumer", version: "1.0.0" },
				async (context) => {
					context.addRoute("GET", "/calculate", async () => {
						const calculator = context.getService(
							"service-provider:calculator",
						);
						const result = calculator.add(5, 3) * calculator.multiply(2, 2);
						return json({ result });
					});
				},
			);

			await app.register(serviceProviderPlugin);
			await app.register(serviceConsumerPlugin);

			const response = await app.request.get("/calculate");
			const data = await response.json();
			expect(data.result).toBe(32); // (5 + 3) * (2 * 2) = 8 * 4 = 32
		});

		test("should handle service scoping correctly", async () => {
			const app = createMockServer();
			const plugin1 = createPlugin(
				{ name: "plugin1", version: "1.0.0" },
				async (context) => {
					context.registerService("shared", { plugin: "plugin1" });
					context.registerService("private", { plugin: "plugin1" });
				},
			);

			const plugin2 = createPlugin(
				{ name: "plugin2", version: "1.0.0" },
				async (context) => {
					context.addRoute("GET", "/service-test", async () => {
						const shared = context.getService("plugin1:shared");
						const private1 = context.getService("plugin1:private");
						const private2 = context.getService("private"); // Should not find plugin1's private service

						return json({
							shared: shared?.plugin || null,
							private1: private1?.plugin || null,
							private2: private2?.plugin || null,
						});
					});
				},
			);

			await app.register(plugin1);
			await app.register(plugin2);

			const response = await app.request.get("/service-test");
			const data = await response.json();

			expect(data.shared).toBe("plugin1");
			expect(data.private1).toBe("plugin1");
			expect(data.private2).toBe(null);
		});
	});

	describe("Plugin Builder", () => {
		test("should create plugins using builder pattern", async () => {
			const app = createMockServer();
			const builderPlugin = plugin("builder-test", "1.0.0")
				.setDescription("Test plugin using builder")
				.setConfig({ testValue: 42 })
				.addHooks({
					beforeStart: (context) => {
						context.storage.set("builderTest", true);
					},
				})
				.onRegister(async (context) => {
					context.addRoute("GET", "/builder-test", async () => {
						return json({
							config: context.config,
							builderTestRan: context.storage.get("builderTest"),
						});
					});
				})
				.build();

			await app.register(builderPlugin);
			await app.startPlugins();

			const response = await app.request.get("/builder-test");
			const data = await response.json();

			expect(data.config.testValue).toBe(42);
			expect(data.builderTestRan).toBe(true);
		});

		test("should validate required fields in builder", () => {
			expect(() => {
				plugin("test", "1.0.0").build();
			}).toThrow("Plugin register function is required");

			expect(() => {
				plugin("", "1.0.0")
					.onRegister(() => {})
					.build();
			}).toThrow("Plugin name is required");

			expect(() => {
				plugin("test", "")
					.onRegister(() => {})
					.build();
			}).toThrow("Plugin version is required");
		});
	});

	describe("Plugin Configuration", () => {
		test("should merge plugin config with registration options", async () => {
			const app = createMockServer();
			const configPlugin = createPlugin(
				{ name: "config-test", version: "1.0.0" },
				async (context) => {
					context.addRoute("GET", "/config", async () => {
						return json(context.config);
					});
				},
				undefined,
				{ defaultValue: "default", overrideMe: "original" },
			);

			await app.register(configPlugin, {
				config: { overrideMe: "overridden", newValue: "new" },
			});

			const response = await app.request.get("/config");
			const data = await response.json();

			expect(data.defaultValue).toBe("default");
			expect(data.overrideMe).toBe("overridden");
			expect(data.newValue).toBe("new");
		});

		test("should handle plugin prefixes", async () => {
			const app = createMockServer();
			const prefixPlugin = createPlugin(
				{ name: "prefix-test", version: "1.0.0" },
				async (context) => {
					context.addRoute("GET", "/test", async () => {
						return text("Prefixed route");
					});
				},
			);

			await app.register(prefixPlugin, { prefix: "/api/v1" });

			const response = await app.request.get("/api/v1/test");
			expect(response.status).toBe(200);
			expect(await response.text()).toBe("Prefixed route");

			// Original route should not exist (no prefix)
			const originalResponse = await app.request.get("/test");
			expect(originalResponse.status).toBe(404);
		});
	});

	describe("Error Handling", () => {
		test("should handle plugin registration errors gracefully", async () => {
			const app = createMockServer();
			const errorPlugin = createPlugin(
				{ name: "error-test", version: "1.0.0" },
				async () => {
					throw new Error("Plugin registration failed");
				},
			);

			await expect(app.register(errorPlugin)).rejects.toThrow(
				"Plugin registration failed",
			);
			expect(app.plugins.hasPlugin("error-test")).toBe(false);
		});

		test("should handle lifecycle hook errors", async () => {
			const app = createMockServer();
			const hookErrorPlugin = createPlugin(
				{ name: "hook-error-test", version: "1.0.0" },
				async () => {},
				{
					beforeStart: async () => {
						throw new Error("Hook failed");
					},
				},
			);

			await app.register(hookErrorPlugin);
			await expect(app.startPlugins()).rejects.toThrow("Hook failed");
		});
	});

	describe("Plugin Metadata", () => {
		test("should track plugin metadata correctly", async () => {
			const app = createMockServer();
			const metadataPlugin = createPlugin(
				{
					name: "metadata-test",
					version: "2.1.0",
					description: "Test plugin with metadata",
					author: "Test Author",
					tags: ["test", "metadata"],
					dependencies: [],
				},
				async () => {},
			);

			await app.register(metadataPlugin);

			const metadata = app.plugins.getPluginMetadata();
			const pluginMeta = metadata.find((p: any) => p.name === "metadata-test");

			expect(pluginMeta).toBeDefined();
			expect(pluginMeta.version).toBe("2.1.0");
			expect(pluginMeta.description).toBe("Test plugin with metadata");
			expect(pluginMeta.author).toBe("Test Author");
			expect(pluginMeta.tags).toEqual(["test", "metadata"]);
		});

		test("should provide plugin information to other plugins", async () => {
			const app = createMockServer();
			const infoPlugin = createPlugin(
				{ name: "info-test", version: "1.0.0" },
				async (context) => {
					context.addRoute("GET", "/plugin-info", async () => {
						return json({
							plugins: context.server.plugins.getPluginMetadata(),
							services: Array.from(context.server.plugins.getServices().keys()),
						});
					});
				},
			);

			await app.register(infoPlugin);

			const response = await app.request.get("/plugin-info");
			const data = await response.json();

			expect(data.plugins).toHaveLength(1);
			expect(data.plugins[0].name).toBe("info-test");
			expect(Array.isArray(data.services)).toBe(true);
		});
	});

	describe("Plugin Integration with Mock Server", () => {
		test("should work seamlessly with mock server requests", async () => {
			const app = createMockServer();

			// Register a plugin that adds authentication middleware
			const authPlugin = createPlugin(
				{ name: "auth-plugin", version: "1.0.0" },
				async (context) => {
					context.addMiddleware(async (req, next) => {
						const auth = req.headers.get("authorization");
						if (req.url.includes("/protected") && !auth) {
							return new Response("Unauthorized", { status: 401 });
						}
						return next();
					});
				},
			);

			// Register a plugin that adds routes
			const apiPlugin = createPlugin(
				{ name: "api-plugin", version: "1.0.0" },
				async (context) => {
					context.addRoute("GET", "/api/health", () => json({ status: "ok" }));
					context.addRoute("GET", "/protected/data", () =>
						json({ secret: "data" }),
					);
				},
			);

			await app.register(authPlugin);
			await app.register(apiPlugin);

			// Test public route
			const healthResponse = await app.request.get("/api/health");
			expect(healthResponse.status).toBe(200);
			expect(await healthResponse.json()).toEqual({ status: "ok" });

			// Test protected route without auth
			const protectedResponse = await app.request.get("/protected/data");
			expect(protectedResponse.status).toBe(401);

			// Test protected route with auth
			const authorizedResponse = await app.request.get("/protected/data", {
				headers: { authorization: "Bearer token" },
			});
			expect(authorizedResponse.status).toBe(200);
			expect(await authorizedResponse.json()).toEqual({ secret: "data" });
		});

		test("should handle plugin POST requests with body parsing", async () => {
			const app = createMockServer();

			const dataPlugin = createPlugin(
				{ name: "data-plugin", version: "1.0.0" },
				async (context) => {
					context.addRoute("POST", "/api/data", async (req) => {
						const body = await req.json();
						return json({ received: body, processed: true });
					});
				},
			);

			await app.register(dataPlugin);

			const response = await app.request.post("/api/data", {
				name: "test",
				value: 42,
			});
			expect(response.status).toBe(200);

			const data = await response.json();
			expect(data.received).toEqual({ name: "test", value: 42 });
			expect(data.processed).toBe(true);
		});
	});
});
