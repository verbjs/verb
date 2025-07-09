import { test, expect } from "bun:test";
import { createTcpServer } from "../../src/server/tcp";

test("TCP server - creates server instance", () => {
  const server = createTcpServer();
  
  expect(server).toBeDefined();
  expect(server.onConnection).toBeDefined();
  expect(server.onData).toBeDefined();
  expect(server.onClose).toBeDefined();
  expect(server.onError).toBeDefined();
  expect(server.listen).toBeDefined();
  expect(server.withOptions).toBeDefined();
});

test("TCP server - handles connection events", () => {
  const server = createTcpServer();
  
  let receivedConnection = null;
  
  server.onConnection((connection) => {
    receivedConnection = connection;
  });
  
  // Handler is registered but not called in this test
  expect(receivedConnection).toBe(null);
});

test("TCP server - handles data events", () => {
  const server = createTcpServer();
  
  let receivedData = null;
  let receivedConnection = null;
  
  server.onData((connection, data) => {
    receivedConnection = connection;
    receivedData = data;
  });
  
  // Handler is registered but not called in this test
  expect(receivedData).toBe(null);
  expect(receivedConnection).toBe(null);
});

test("TCP server - handles close events", () => {
  const server = createTcpServer();
  
  let closedConnection = null;
  
  server.onClose((connection) => {
    closedConnection = connection;
  });
  
  // Handler is registered but not called in this test
  expect(closedConnection).toBe(null);
});

test("TCP server - handles error events", () => {
  const server = createTcpServer();
  
  let receivedError = null;
  
  server.onError((error) => {
    receivedError = error;
  });
  
  // Handler is registered but not called in this test
  expect(receivedError).toBe(null);
});

test("TCP server - configures with options", () => {
  const server = createTcpServer();
  
  server.withOptions({
    port: 3000,
    hostname: "0.0.0.0"
  });
  
  // Options are stored internally
  expect(server.withOptions).toBeDefined();
});

test("TCP server - starts listening", async () => {
  const server = createTcpServer();
  
  server.withOptions({
    port: 3000,
    hostname: "localhost"
  });
  
  const result = await server.listen();
  
  expect(result).toBeDefined();
  expect(result.port).toBe(3000);
  expect(result.hostname).toBe("localhost");
  expect(result.type).toBe("tcp");
  expect(result.close).toBeDefined();
  expect(result.connections).toBeDefined();
});

test("TCP server - handles custom port and hostname", async () => {
  const server = createTcpServer();
  
  const result = await server.listen(5000, "0.0.0.0");
  
  expect(result.port).toBe(5000);
  expect(result.hostname).toBe("0.0.0.0");
  expect(result.type).toBe("tcp");
});

test("TCP server - simulates connection handling", async () => {
  const server = createTcpServer();
  
  let receivedConnection = null;
  
  server.onConnection((connection) => {
    receivedConnection = connection;
  });
  
  const result = await server.listen(3000, "localhost");
  
  // Simulate a new connection
  const connection = result._simulateConnection("192.168.1.100", 12345);
  
  expect(receivedConnection).toBeDefined();
  expect(receivedConnection.remoteAddress).toBe("192.168.1.100");
  expect(receivedConnection.remotePort).toBe(12345);
  expect(receivedConnection.id).toBeDefined();
  expect(receivedConnection.write).toBeDefined();
  expect(receivedConnection.end).toBeDefined();
  expect(receivedConnection.destroy).toBeDefined();
});

test("TCP server - simulates data handling", async () => {
  const server = createTcpServer();
  
  let receivedConnection = null;
  let receivedData = null;
  
  server.onConnection((connection) => {
    receivedConnection = connection;
  });
  
  server.onData((connection, data) => {
    receivedData = data;
  });
  
  const result = await server.listen(3000, "localhost");
  
  // Simulate a new connection
  const connection = result._simulateConnection("192.168.1.100", 12345);
  
  // Simulate data from the connection
  result._simulateData(connection.id, "Hello TCP Server");
  
  expect(receivedConnection).toBeDefined();
  expect(receivedData).toBeDefined();
  expect(receivedData.toString()).toBe("Hello TCP Server");
});

test("TCP server - handles connection write", async () => {
  const server = createTcpServer();
  
  let receivedConnection = null;
  
  server.onConnection((connection) => {
    receivedConnection = connection;
  });
  
  const result = await server.listen(3000, "localhost");
  
  // Mock console.log to capture output
  const originalLog = console.log;
  let loggedMessage = "";
  console.log = (message) => {
    loggedMessage = message;
  };
  
  // Simulate a new connection
  const connection = result._simulateConnection("192.168.1.100", 12345);
  
  // Write data to the connection
  connection.write("Hello Client");
  
  expect(loggedMessage).toContain("TCP Send to 192.168.1.100:12345");
  expect(loggedMessage).toContain("Hello Client");
  
  // Restore console.log
  console.log = originalLog;
});

test("TCP server - handles connection end", async () => {
  const server = createTcpServer();
  
  let receivedConnection = null;
  let closedConnection = null;
  
  server.onConnection((connection) => {
    receivedConnection = connection;
  });
  
  server.onClose((connection) => {
    closedConnection = connection;
  });
  
  const result = await server.listen(3000, "localhost");
  
  // Mock console.log to capture output
  const originalLog = console.log;
  let loggedMessage = "";
  console.log = (message) => {
    loggedMessage = message;
  };
  
  // Simulate a new connection
  const connection = result._simulateConnection("192.168.1.100", 12345);
  
  // End the connection
  connection.end();
  
  expect(loggedMessage).toContain("TCP Connection");
  expect(loggedMessage).toContain("ended gracefully");
  expect(closedConnection).toBeDefined();
  
  // Restore console.log
  console.log = originalLog;
});

test("TCP server - handles connection destroy", async () => {
  const server = createTcpServer();
  
  let receivedConnection = null;
  let closedConnection = null;
  
  server.onConnection((connection) => {
    receivedConnection = connection;
  });
  
  server.onClose((connection) => {
    closedConnection = connection;
  });
  
  const result = await server.listen(3000, "localhost");
  
  // Mock console.log to capture output
  const originalLog = console.log;
  let loggedMessage = "";
  console.log = (message) => {
    loggedMessage = message;
  };
  
  // Simulate a new connection
  const connection = result._simulateConnection("192.168.1.100", 12345);
  
  // Destroy the connection
  connection.destroy();
  
  expect(loggedMessage).toContain("TCP Connection");
  expect(loggedMessage).toContain("destroyed");
  expect(closedConnection).toBeDefined();
  
  // Restore console.log
  console.log = originalLog;
});

test("TCP server - simulates error handling", async () => {
  const server = createTcpServer();
  
  let receivedError = null;
  
  server.onError((error) => {
    receivedError = error;
  });
  
  const result = await server.listen(3000, "localhost");
  
  // Simulate an error
  const testError = new Error("Connection error");
  result._simulateError(testError);
  
  expect(receivedError).toBeDefined();
  expect(receivedError.message).toBe("Connection error");
});

test("TCP server - handles multiple connections", async () => {
  const server = createTcpServer();
  
  const connections = [];
  
  server.onConnection((connection) => {
    connections.push(connection);
  });
  
  const result = await server.listen(3000, "localhost");
  
  // Simulate multiple connections
  const connection1 = result._simulateConnection("192.168.1.100", 12345);
  const connection2 = result._simulateConnection("192.168.1.101", 12346);
  const connection3 = result._simulateConnection("192.168.1.102", 12347);
  
  expect(connections.length).toBe(3);
  expect(connections[0].remoteAddress).toBe("192.168.1.100");
  expect(connections[1].remoteAddress).toBe("192.168.1.101");
  expect(connections[2].remoteAddress).toBe("192.168.1.102");
  
  // Verify connections are tracked in the server
  expect(result.connections.size).toBe(3);
});

test("TCP server - handles server close", async () => {
  const server = createTcpServer();
  
  const result = await server.listen(3000, "localhost");
  
  // Mock console.log to capture output
  const originalLog = console.log;
  let loggedMessage = "";
  console.log = (message) => {
    loggedMessage = message;
  };
  
  result.close();
  
  expect(loggedMessage).toContain("TCP Server stopped");
  
  // Restore console.log
  console.log = originalLog;
});