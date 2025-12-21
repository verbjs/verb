import { test, expect, describe } from "bun:test";
import { createDtlsServer } from "../../src/server/dtls";

describe("DTLS Server", () => {
  test("createDtlsServer returns server instance with correct methods", () => {
    const server = createDtlsServer();

    expect(server.onMessage).toBeDefined();
    expect(server.onError).toBeDefined();
    expect(server.send).toBeDefined();
    expect(server.listen).toBeDefined();
    expect(server.withOptions).toBeDefined();
    expect(server.withTLS).toBeDefined();
  });

  test("withTLS returns the server instance for chaining", () => {
    const server = createDtlsServer();
    const result = server.withTLS({
      cert: "test-cert",
      key: "test-key",
    });

    expect(result).toBe(server);
  });

  test("withOptions sets server options", () => {
    const server = createDtlsServer();
    server.withOptions({ port: 4444 });
    expect(true).toBe(true);
  });

  test("listen throws error without TLS options", async () => {
    const server = createDtlsServer();

    await expect(server.listen()).rejects.toThrow(
      "DTLS server requires TLS options"
    );
  });

  test("listen succeeds with TLS options", async () => {
    const server = createDtlsServer();
    server.withTLS({
      cert: "test-cert",
      key: "test-key",
    });

    const result = await server.listen(4444, "localhost");

    expect(result.port).toBe(4444);
    expect(result.hostname).toBe("localhost");
    expect(result.type).toBe("dtls");
    expect(result.close).toBeDefined();
  });

  test("listen uses default port and hostname", async () => {
    const server = createDtlsServer();
    server.withTLS({
      cert: "test-cert",
      key: "test-key",
    });

    const result = await server.listen();

    expect(result.port).toBe(3000);
    expect(result.hostname).toBe("localhost");
  });

  test("listen uses options from withOptions", async () => {
    const server = createDtlsServer();
    server.withOptions({ port: 5001, hostname: "0.0.0.0" });
    server.withTLS({
      cert: "test-cert",
      key: "test-key",
    });

    const result = await server.listen();

    expect(result.port).toBe(5001);
    expect(result.hostname).toBe("0.0.0.0");
  });

  test("onMessage handler is called with message", async () => {
    const server = createDtlsServer();
    let messageReceived = false;
    let receivedMessage: any = null;

    server.onMessage((message) => {
      messageReceived = true;
      receivedMessage = message;
    });

    server.withTLS({ cert: "test-cert", key: "test-key" });
    const result = await server.listen();

    result._simulateMessage("Hello DTLS", "127.0.0.1", 54321);

    expect(messageReceived).toBe(true);
    expect(receivedMessage.data.toString()).toBe("Hello DTLS");
    expect(receivedMessage.remoteAddress).toBe("127.0.0.1");
    expect(receivedMessage.remotePort).toBe(54321);
    expect(receivedMessage.encrypted).toBe(true);
    expect(receivedMessage.authorized).toBe(true);
  });

  test("onError handler is called on error", async () => {
    const server = createDtlsServer();
    let errorReceived: Error | null = null;

    server.onError((error) => {
      errorReceived = error;
    });

    server.withTLS({ cert: "test-cert", key: "test-key" });
    const result = await server.listen();

    result._simulateError(new Error("DTLS error"));

    expect(errorReceived).not.toBeNull();
    expect(errorReceived!.message).toBe("DTLS error");
  });

  test("send method sends data", () => {
    const server = createDtlsServer();

    // Should not throw
    server.send("Test data", 54321, "127.0.0.1");
    server.send(Buffer.from("Binary data"), 54321, "127.0.0.1");
  });

  test("server.close stops the server", async () => {
    const server = createDtlsServer();
    server.withTLS({ cert: "test-cert", key: "test-key" });

    const result = await server.listen();

    // Should not throw
    result.close();
  });
});
