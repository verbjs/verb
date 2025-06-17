import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { createMockServer } from "../../src/mock.ts";
import { clearCache } from "../../src/cache.ts";
import {
	MemorySessionStore,
	RedisSessionStore,
	SessionManager,
	session,
	getSession,
	setSessionData,
	getSessionData,
	clearSessionData,
	destroySession,
	generateSessionId,
	sign,
	unsign,
	parseCookies,
	serializeCookie,
} from "../../src/session.ts";
import { json } from "../../src/response.ts";

describe("Session Management System", () => {
	let server: any;

	beforeEach(() => {
		clearCache();
		server = createMockServer();
	});

	describe("Session ID Generation", () => {
		it("should generate unique session IDs", () => {
			const id1 = generateSessionId();
			const id2 = generateSessionId();

			expect(id1).toBeDefined();
			expect(id2).toBeDefined();
			expect(id1).not.toBe(id2);
			expect(id1.length).toBe(64); // 32 bytes * 2 (hex)
			expect(id2.length).toBe(64);
		});

		it("should generate hex strings", () => {
			const id = generateSessionId();
			expect(/^[a-f0-9]+$/i.test(id)).toBe(true);
		});
	});

	describe("Cookie Signing", () => {
		const secret = "test-secret";

		it("should sign values", () => {
			const value = "test-value";
			const signed = sign(value, secret);

			expect(signed).toContain(".");
			expect(signed.startsWith(value + ".")).toBe(true);
		});

		it("should unsign valid signatures", () => {
			const value = "test-value";
			const signed = sign(value, secret);
			const unsigned = unsign(signed, secret);

			expect(unsigned).toBe(value);
		});

		it("should reject invalid signatures", () => {
			const value = "test-value";
			const signed = sign(value, secret);
			const tampered = signed.replace(/.$/, "x"); // Change last character
			const unsigned = unsign(tampered, secret);

			expect(unsigned).toBe(false);
		});

		it("should reject malformed signatures", () => {
			const unsigned = unsign("no-dot-value", secret);
			expect(unsigned).toBe(false);
		});
	});

	describe("Cookie Parsing and Serialization", () => {
		it("should parse cookie header", () => {
			const header = "sessionId=abc123; theme=dark; lang=en";
			const cookies = parseCookies(header);

			expect(cookies.sessionId).toBe("abc123");
			expect(cookies.theme).toBe("dark");
			expect(cookies.lang).toBe("en");
		});

		it("should handle empty cookie header", () => {
			const cookies = parseCookies(null);
			expect(cookies).toEqual({});
		});

		it("should handle URL encoded values", () => {
			const header = "data=hello%20world";
			const cookies = parseCookies(header);
			expect(cookies.data).toBe("hello world");
		});

		it("should serialize basic cookie", () => {
			const cookie = serializeCookie("sessionId", "abc123");
			expect(cookie).toBe("sessionId=abc123");
		});

		it("should serialize cookie with options", () => {
			const cookie = serializeCookie("sessionId", "abc123", {
				maxAge: 3600,
				path: "/",
				httpOnly: true,
				secure: true,
				sameSite: "strict",
			});

			expect(cookie).toContain("sessionId=abc123");
			expect(cookie).toContain("Max-Age=3600");
			expect(cookie).toContain("Path=/");
			expect(cookie).toContain("HttpOnly");
			expect(cookie).toContain("Secure");
			expect(cookie).toContain("SameSite=strict");
		});

		it("should serialize cookie with expires date", () => {
			const expires = new Date("2024-12-31T23:59:59Z");
			const cookie = serializeCookie("sessionId", "abc123", { expires });

			expect(cookie).toContain("sessionId=abc123");
			expect(cookie).toContain("Expires=Tue, 31 Dec 2024 23:59:59 GMT");
		});
	});

	describe("Memory Session Store", () => {
		let store: MemorySessionStore;

		beforeEach(() => {
			store = new MemorySessionStore();
		});

		afterEach(async () => {
			await store.clear();
		});

		it("should store and retrieve session", async () => {
			const sessionId = "test-session";
			const sessionData = {
				id: sessionId,
				data: { userId: 123 },
				createdAt: new Date(),
				updatedAt: new Date(),
				expiresAt: new Date(Date.now() + 3600000),
				isNew: false,
			};

			await store.set(sessionId, sessionData);
			const retrieved = await store.get(sessionId);

			expect(retrieved).toBeDefined();
			expect(retrieved!.id).toBe(sessionId);
			expect(retrieved!.data.userId).toBe(123);
			expect(retrieved!.isNew).toBe(false);
		});

		it("should return null for non-existent session", async () => {
			const session = await store.get("non-existent");
			expect(session).toBeNull();
		});

		it("should expire sessions automatically", async () => {
			const sessionId = "expiring-session";
			const sessionData = {
				id: sessionId,
				data: { userId: 123 },
				createdAt: new Date(),
				updatedAt: new Date(),
				expiresAt: new Date(Date.now() + 100), // Expire in 100ms
				isNew: false,
			};

			await store.set(sessionId, sessionData);

			// Wait for expiration
			await new Promise((resolve) => setTimeout(resolve, 150));

			const retrieved = await store.get(sessionId);
			expect(retrieved).toBeNull();
		});

		it("should destroy session", async () => {
			const sessionId = "to-destroy";
			const sessionData = {
				id: sessionId,
				data: { userId: 123 },
				createdAt: new Date(),
				updatedAt: new Date(),
				expiresAt: new Date(Date.now() + 3600000),
				isNew: false,
			};

			await store.set(sessionId, sessionData);
			await store.destroy(sessionId);

			const retrieved = await store.get(sessionId);
			expect(retrieved).toBeNull();
		});

		it("should touch session to update timestamp", async () => {
			const sessionId = "to-touch";
			const sessionData = {
				id: sessionId,
				data: { userId: 123 },
				createdAt: new Date(),
				updatedAt: new Date(Date.now() - 1000),
				expiresAt: new Date(Date.now() + 3600000),
				isNew: false,
			};

			await store.set(sessionId, sessionData);
			await new Promise((resolve) => setTimeout(resolve, 10));
			await store.touch(sessionId);

			const retrieved = await store.get(sessionId);
			expect(retrieved!.updatedAt.getTime()).toBeGreaterThan(
				sessionData.updatedAt.getTime(),
			);
		});

		it("should report correct length", async () => {
			expect(await store.length()).toBe(0);

			await store.set("session1", {
				id: "session1",
				data: {},
				createdAt: new Date(),
				updatedAt: new Date(),
				expiresAt: new Date(Date.now() + 3600000),
				isNew: false,
			});

			expect(await store.length()).toBe(1);

			await store.set("session2", {
				id: "session2",
				data: {},
				createdAt: new Date(),
				updatedAt: new Date(),
				expiresAt: new Date(Date.now() + 3600000),
				isNew: false,
			});

			expect(await store.length()).toBe(2);
		});

		it("should clear all sessions", async () => {
			await store.set("session1", {
				id: "session1",
				data: {},
				createdAt: new Date(),
				updatedAt: new Date(),
				expiresAt: new Date(Date.now() + 3600000),
				isNew: false,
			});

			await store.set("session2", {
				id: "session2",
				data: {},
				createdAt: new Date(),
				updatedAt: new Date(),
				expiresAt: new Date(Date.now() + 3600000),
				isNew: false,
			});

			expect(await store.length()).toBe(2);
			await store.clear();
			expect(await store.length()).toBe(0);
		});
	});

	describe("Session Manager", () => {
		it("should create with default options", () => {
			const manager = new SessionManager();
			expect(manager).toBeDefined();
			expect(manager.getStore()).toBeInstanceOf(MemorySessionStore);
		});

		it("should create with custom store", () => {
			const customStore = new MemorySessionStore();
			const manager = new SessionManager({ store: customStore });
			expect(manager.getStore()).toBe(customStore);
		});

		it("should destroy session", async () => {
			const store = new MemorySessionStore();
			const manager = new SessionManager({ store });

			await store.set("test-session", {
				id: "test-session",
				data: {},
				createdAt: new Date(),
				updatedAt: new Date(),
				expiresAt: new Date(Date.now() + 3600000),
				isNew: false,
			});

			await manager.destroySession("test-session");
			const retrieved = await store.get("test-session");
			expect(retrieved).toBeNull();
		});
	});

	describe("Session Middleware Integration", () => {
		it("should create session for new requests", async () => {
			server.use(session({ secret: "test-secret" }));
			server.get("/test", (req: Request) => {
				const session = getSession(req);
				return json({
					hasSession: !!session,
					sessionId: session?.id,
					isNew: session?.isNew,
				});
			});

			const response = await server.request.get("/test");
			const data = await response.json();

			expect(data.hasSession).toBe(true);
			expect(data.sessionId).toBeDefined();
			expect(data.isNew).toBe(true);
			expect(response.headers.get("Set-Cookie")).toContain("sessionId=");
		});

		it("should persist session data", async () => {
			server.use(session({ secret: "test-secret" }));

			server.post("/set", (req: Request) => {
				setSessionData(req, "userId", 123);
				setSessionData(req, "name", "John Doe");
				return json({ success: true });
			});

			server.get("/get", (req: Request) => {
				return json({
					userId: getSessionData(req, "userId"),
					name: getSessionData(req, "name"),
				});
			});

			// Set session data
			const setResponse = await server.request.post("/set");
			const setCookie = setResponse.headers.get("Set-Cookie");
			expect(setCookie).toBeDefined();

			// Get session data with cookie
			const getResponse = await server.request.get("/get", {
				headers: { Cookie: setCookie! },
			});
			const getData = await getResponse.json();

			expect(getData.userId).toBe(123);
			expect(getData.name).toBe("John Doe");
		});

		it("should handle session expiration", async () => {
			server.use(
				session({
					secret: "test-secret",
					cookie: { maxAge: 100 }, // 100ms expiration
				}),
			);

			server.get("/test", (req: Request) => {
				const session = getSession(req);
				return json({
					hasSession: !!session,
					sessionId: session?.id,
				});
			});

			// Create session
			const response1 = await server.request.get("/test");
			const data1 = await response1.json();
			const cookie = response1.headers.get("Set-Cookie");

			expect(data1.hasSession).toBe(true);
			expect(cookie).toBeDefined();

			// Wait for expiration
			await new Promise((resolve) => setTimeout(resolve, 150));

			// Try to use expired session
			const response2 = await server.request.get("/test", {
				headers: { Cookie: cookie! },
			});
			const data2 = await response2.json();

			expect(data2.hasSession).toBe(true);
			expect(data2.sessionId).not.toBe(data1.sessionId); // New session created
		});

		it("should clear session data", async () => {
			server.use(session({ secret: "test-secret" }));

			server.post("/set", (req: Request) => {
				setSessionData(req, "data", "important");
				return json({ success: true });
			});

			server.post("/clear", (req: Request) => {
				clearSessionData(req);
				return json({ success: true });
			});

			server.get("/get", (req: Request) => {
				return json({
					data: getSessionData(req, "data"),
				});
			});

			// Set data
			const setResponse = await server.request.post("/set");
			const cookie = setResponse.headers.get("Set-Cookie")!;

			// Verify data exists
			const getResponse1 = await server.request.get("/get", {
				headers: { Cookie: cookie },
			});
			const getData1 = await getResponse1.json();
			expect(getData1.data).toBe("important");

			// Clear data
			await server.request.post(
				"/clear",
				{},
				{
					headers: { Cookie: cookie },
				},
			);

			// Verify data is cleared
			const getResponse2 = await server.request.get("/get", {
				headers: { Cookie: cookie },
			});
			const getData2 = await getResponse2.json();
			expect(getData2.data).toBeUndefined();
		});

		it("should handle rolling sessions", async () => {
			server.use(
				session({
					secret: "test-secret",
					rolling: true,
					cookie: { maxAge: 1000 },
				}),
			);

			server.get("/test", (req: Request) => {
				const session = getSession(req);
				// Access session data to trigger a save
				setSessionData(req, "accessed", true);
				return json({
					sessionId: session?.id,
					expiresAt: session?.expiresAt.toISOString(),
				});
			});

			// Create session
			const response1 = await server.request.get("/test");
			const data1 = await response1.json();
			const cookie = response1.headers.get("Set-Cookie")!;
			const originalExpiry = new Date(data1.expiresAt).getTime();

			// Wait a bit to ensure different timestamps
			await new Promise((resolve) => setTimeout(resolve, 50));

			// Access session (should roll expiration)
			const response2 = await server.request.get("/test", {
				headers: { Cookie: cookie },
			});
			const data2 = await response2.json();
			const newExpiry = new Date(data2.expiresAt).getTime();

			expect(data2.sessionId).toBe(data1.sessionId);
			// Rolling sessions should extend the expiration time
			expect(newExpiry).toBeGreaterThanOrEqual(originalExpiry);
		});

		it("should handle unsigned cookies when signing disabled", async () => {
			server.use(
				session({
					secret: "test-secret",
					cookie: { signed: false },
				}),
			);

			server.get("/test", (req: Request) => {
				const session = getSession(req);
				setSessionData(req, "test", "value");
				return json({ sessionId: session?.id });
			});

			const response = await server.request.get("/test");
			const data = await response.json();
			const cookie = response.headers.get("Set-Cookie")!;

			expect(data.sessionId).toBeDefined();
			expect(cookie).not.toContain("."); // No signature
		});
	});

	describe("Session Helper Functions", () => {
		it("should return null for request without session", () => {
			const req = new Request("http://test.com");
			const session = getSession(req);
			expect(session).toBeNull();
		});

		it("should return undefined for non-existent session data", () => {
			const req = new Request("http://test.com");
			const data = getSessionData(req, "nonexistent");
			expect(data).toBeUndefined();
		});

		it("should handle session operations on request without session", () => {
			const req = new Request("http://test.com");

			// These should not throw
			setSessionData(req, "key", "value");
			clearSessionData(req);
			destroySession(req);

			expect(getSession(req)).toBeNull();
		});
	});
});
