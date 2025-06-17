import { expect, test, describe, beforeEach, afterEach } from "bun:test";
import {
	createServer,
	json,
	Logger,
	LogLevel,
	requestLogger,
	performanceLogger,
	errorLogger,
	type LoggerOptions,
} from "../../src/index.ts";

describe("Structured Logging", () => {
	test("should create logger with correct configuration", () => {
		const logger = new Logger({
			level: LogLevel.DEBUG,
			prettyPrint: true,
			context: {
				service: "test",
				environment: "test",
			},
		});

		expect(logger.shouldLog(LogLevel.DEBUG)).toBe(true);
		expect(logger.shouldLog(LogLevel.TRACE)).toBe(false);
	});

	test("should create child logger with correlation ID", () => {
		const logger = new Logger();
		const childLogger = logger.child("test-correlation-id");

		expect(childLogger).toBeDefined();
	});

	test("should respect log levels", () => {
		const logger = new Logger({ level: LogLevel.WARN });

		expect(logger.shouldLog(LogLevel.ERROR)).toBe(true);
		expect(logger.shouldLog(LogLevel.WARN)).toBe(true);
		expect(logger.shouldLog(LogLevel.INFO)).toBe(false);
		expect(logger.shouldLog(LogLevel.DEBUG)).toBe(false);
	});
});

describe("Logging Integration", () => {
	let server: any;
	let baseURL: string;

	beforeEach(() => {
		const app = createServer({ port: 0 });

		// Apply logging middleware
		app.use(requestLogger({ level: LogLevel.INFO }));
		app.use(performanceLogger(100));
		app.use(errorLogger());

		app.get("/test", () => json({ message: "test" }));
		app.get("/slow", async () => {
			await new Promise((resolve) => setTimeout(resolve, 150));
			return json({ message: "slow endpoint" });
		});

		server = app.server;
		baseURL = `http://localhost:${server.port}`;
	});

	afterEach(() => {
		if (server) server.stop();
	});

	test("should include correlation ID in response", async () => {
		const response = await fetch(`${baseURL}/test`, {
			headers: { "x-correlation-id": "test-123" },
		});

		expect(response.headers.get("x-correlation-id")).toBe("test-123");
	});

	test("should log requests automatically", async () => {
		const response = await fetch(`${baseURL}/test`);
		expect(response.status).toBe(200);

		// Request logging happens in background
		// In a real test, you might capture logs to verify content
	});

	test("should handle slow requests", async () => {
		const response = await fetch(`${baseURL}/slow`);
		expect(response.status).toBe(200);

		// Performance logger should detect slow request
		const data = await response.json();
		expect(data.message).toBe("slow endpoint");
	});
});

console.log("✅ Structured Logging Test Suite Complete");
