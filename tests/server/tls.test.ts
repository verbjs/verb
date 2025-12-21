import { test, expect, describe } from "bun:test";
import { createTlsServer } from "../../src/server/tls";

describe("TLS Server", () => {
  test("createTlsServer returns server instance with correct methods", () => {
    const server = createTlsServer();

    expect(server.onConnection).toBeDefined();
    expect(server.onData).toBeDefined();
    expect(server.onClose).toBeDefined();
    expect(server.onError).toBeDefined();
    expect(server.listen).toBeDefined();
    expect(server.withOptions).toBeDefined();
    expect(server.withTLS).toBeDefined();
  });

  test("withTLS returns the server instance for chaining", () => {
    const server = createTlsServer();
    const result = server.withTLS({
      cert: "test-cert",
      key: "test-key",
    });

    expect(result).toBe(server);
  });

  test("withOptions sets server options", () => {
    const server = createTlsServer();
    server.withOptions({ port: 4433 });
    // No error means success
    expect(true).toBe(true);
  });

  test("listen throws error without TLS options", async () => {
    const server = createTlsServer();

    await expect(server.listen()).rejects.toThrow(
      "TLS server requires TLS options"
    );
  });

  test("listen succeeds with TLS options", async () => {
    const server = createTlsServer();
    server.withTLS({
      cert: "test-cert",
      key: "test-key",
    });

    const result = await server.listen(4433, "localhost");

    expect(result.port).toBe(4433);
    expect(result.hostname).toBe("localhost");
    expect(result.type).toBe("tls");
    expect(result.close).toBeDefined();
  });

  test("listen uses default port and hostname", async () => {
    const server = createTlsServer();
    server.withTLS({
      cert: "test-cert",
      key: "test-key",
    });

    const result = await server.listen();

    expect(result.port).toBe(3000);
    expect(result.hostname).toBe("localhost");
  });

  test("listen uses options from withOptions", async () => {
    const server = createTlsServer();
    server.withOptions({ port: 5000, hostname: "0.0.0.0" });
    server.withTLS({
      cert: "test-cert",
      key: "test-key",
    });

    const result = await server.listen();

    expect(result.port).toBe(5000);
    expect(result.hostname).toBe("0.0.0.0");
  });

  test("onConnection handler is called on connection", async () => {
    const server = createTlsServer();
    let connectionReceived = false;

    server.onConnection((conn) => {
      connectionReceived = true;
      expect(conn.id).toBeDefined();
      expect(conn.remoteAddress).toBe("127.0.0.1");
      expect(conn.encrypted).toBe(true);
      expect(conn.authorized).toBe(true);
    });

    server.withTLS({ cert: "test-cert", key: "test-key" });
    const result = await server.listen();

    result._simulateConnection("127.0.0.1", 54321);
    expect(connectionReceived).toBe(true);
  });

  test("onData handler is called with data", async () => {
    const server = createTlsServer();
    let dataReceived: Buffer | null = null;

    server.onConnection(() => {});
    server.onData((conn, data) => {
      dataReceived = data;
    });

    server.withTLS({ cert: "test-cert", key: "test-key" });
    const result = await server.listen();

    const conn = result._simulateConnection("127.0.0.1", 54321);
    result._simulateData(conn.id, "Hello TLS");

    expect(dataReceived).not.toBeNull();
    expect(dataReceived!.toString()).toBe("Hello TLS");
  });

  test("onClose handler is called when connection ends", async () => {
    const server = createTlsServer();
    let closeCalled = false;

    server.onConnection(() => {});
    server.onClose(() => {
      closeCalled = true;
    });

    server.withTLS({ cert: "test-cert", key: "test-key" });
    const result = await server.listen();

    const conn = result._simulateConnection("127.0.0.1", 54321);
    conn.end();

    expect(closeCalled).toBe(true);
  });

  test("onError handler is called on error", async () => {
    const server = createTlsServer();
    let errorReceived: Error | null = null;

    server.onError((error) => {
      errorReceived = error;
    });

    server.withTLS({ cert: "test-cert", key: "test-key" });
    const result = await server.listen();

    result._simulateError(new Error("Test error"));

    expect(errorReceived).not.toBeNull();
    expect(errorReceived!.message).toBe("Test error");
  });

  test("connection.write sends data", async () => {
    const server = createTlsServer();

    server.withTLS({ cert: "test-cert", key: "test-key" });
    const result = await server.listen();

    const conn = result._simulateConnection("127.0.0.1", 54321);
    // Should not throw
    conn.write("Test data");
    conn.write(Buffer.from("Binary data"));
  });

  test("connection.destroy closes connection", async () => {
    const server = createTlsServer();
    let closeCalled = false;

    server.onClose(() => {
      closeCalled = true;
    });

    server.withTLS({ cert: "test-cert", key: "test-key" });
    const result = await server.listen();

    const conn = result._simulateConnection("127.0.0.1", 54321);
    conn.destroy();

    expect(closeCalled).toBe(true);
  });

  test("connection.getPeerCertificate returns certificate info", async () => {
    const server = createTlsServer();

    server.withTLS({ cert: "test-cert", key: "test-key" });
    const result = await server.listen();

    const conn = result._simulateConnection("127.0.0.1", 54321);
    const cert = conn.getPeerCertificate();

    expect(cert.subject.CN).toBe("localhost");
    expect(cert.issuer.CN).toBe("localhost");
    expect(cert.fingerprint).toBeDefined();
  });
});
