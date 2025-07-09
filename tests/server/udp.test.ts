import { test, expect } from "bun:test";
import { createUdpServer } from "../../src/server/udp";

test("UDP server - creates server instance", () => {
  const server = createUdpServer();
  
  expect(server).toBeDefined();
  expect(server.onMessage).toBeDefined();
  expect(server.onError).toBeDefined();
  expect(server.send).toBeDefined();
  expect(server.listen).toBeDefined();
  expect(server.withOptions).toBeDefined();
});

test("UDP server - handles message events", () => {
  const server = createUdpServer();
  
  let receivedMessage = null;
  
  server.onMessage((message) => {
    receivedMessage = message;
  });
  
  // Handler is registered but not called in this test
  expect(receivedMessage).toBe(null);
});

test("UDP server - handles error events", () => {
  const server = createUdpServer();
  
  let receivedError = null;
  
  server.onError((error) => {
    receivedError = error;
  });
  
  // Handler is registered but not called in this test
  expect(receivedError).toBe(null);
});

test("UDP server - sends messages", () => {
  const server = createUdpServer();
  
  // Mock console.log to capture output
  const originalLog = console.log;
  let loggedMessage = "";
  console.log = (message) => {
    loggedMessage = message;
  };
  
  server.send("Hello UDP", 3000, "localhost");
  
  expect(loggedMessage).toContain("UDP Send to localhost:3000");
  expect(loggedMessage).toContain("Hello UDP");
  
  // Restore console.log
  console.log = originalLog;
});

test("UDP server - sends Buffer messages", () => {
  const server = createUdpServer();
  
  // Mock console.log to capture output
  const originalLog = console.log;
  let loggedMessage = "";
  console.log = (message) => {
    loggedMessage = message;
  };
  
  const buffer = Buffer.from("Hello UDP Buffer");
  server.send(buffer, 3001, "127.0.0.1");
  
  expect(loggedMessage).toContain("UDP Send to 127.0.0.1:3001");
  expect(loggedMessage).toContain("Hello UDP Buffer");
  
  // Restore console.log
  console.log = originalLog;
});

test("UDP server - configures with options", () => {
  const server = createUdpServer();
  
  server.withOptions({
    port: 3000,
    hostname: "0.0.0.0"
  });
  
  // Options are stored internally
  expect(server.withOptions).toBeDefined();
});

test("UDP server - starts listening", async () => {
  const server = createUdpServer();
  
  server.withOptions({
    port: 3000,
    hostname: "localhost"
  });
  
  const result = await server.listen();
  
  expect(result).toBeDefined();
  expect(result.port).toBe(3000);
  expect(result.hostname).toBe("localhost");
  expect(result.type).toBe("udp");
  expect(result.close).toBeDefined();
});

test("UDP server - handles custom port and hostname", async () => {
  const server = createUdpServer();
  
  const result = await server.listen(5000, "0.0.0.0");
  
  expect(result.port).toBe(5000);
  expect(result.hostname).toBe("0.0.0.0");
  expect(result.type).toBe("udp");
});

test("UDP server - simulates message handling", async () => {
  const server = createUdpServer();
  
  let receivedMessage = null;
  
  server.onMessage((message) => {
    receivedMessage = message;
  });
  
  const result = await server.listen(3000, "localhost");
  
  // Simulate receiving a message
  result._simulateMessage("Hello from client", "192.168.1.100", 12345);
  
  expect(receivedMessage).toBeDefined();
  expect(receivedMessage.data.toString()).toBe("Hello from client");
  expect(receivedMessage.remoteAddress).toBe("192.168.1.100");
  expect(receivedMessage.remotePort).toBe(12345);
});

test("UDP server - simulates error handling", async () => {
  const server = createUdpServer();
  
  let receivedError = null;
  
  server.onError((error) => {
    receivedError = error;
  });
  
  const result = await server.listen(3000, "localhost");
  
  // Simulate an error
  const testError = new Error("Network error");
  result._simulateError(testError);
  
  expect(receivedError).toBeDefined();
  expect(receivedError.message).toBe("Network error");
});

test("UDP server - handles multiple message handlers", async () => {
  const server = createUdpServer();
  
  let message1 = null;
  let message2 = null;
  
  // Only the last handler will be used (as per implementation)
  server.onMessage((message) => {
    message1 = message;
  });
  
  server.onMessage((message) => {
    message2 = message;
  });
  
  const result = await server.listen(3000, "localhost");
  
  // Simulate receiving a message
  result._simulateMessage("Test message", "127.0.0.1", 8080);
  
  expect(message1).toBe(null); // First handler was overridden
  expect(message2).toBeDefined();
  expect(message2.data.toString()).toBe("Test message");
});

test("UDP server - handles server close", async () => {
  const server = createUdpServer();
  
  const result = await server.listen(3000, "localhost");
  
  // Mock console.log to capture output
  const originalLog = console.log;
  let loggedMessage = "";
  console.log = (message) => {
    loggedMessage = message;
  };
  
  result.close();
  
  expect(loggedMessage).toContain("UDP Server stopped");
  
  // Restore console.log
  console.log = originalLog;
});