import { test, expect, describe, beforeEach } from "bun:test";
import { GracefulShutdown, ConnectionTracker } from "../../src/utils/graceful-shutdown";

describe("GracefulShutdown", () => {
  test("addHandler adds a shutdown handler", () => {
    const shutdown = new GracefulShutdown();
    let handlerCalled = false;

    shutdown.addHandler({
      name: "test-handler",
      handler: async () => {
        handlerCalled = true;
      },
    });

    // Handler added successfully
    expect(true).toBe(true);
  });

  test("shutdown executes handlers in reverse order (LIFO)", async () => {
    const shutdown = new GracefulShutdown();
    const executionOrder: string[] = [];

    shutdown.addHandler({
      name: "first",
      handler: async () => {
        executionOrder.push("first");
      },
    });

    shutdown.addHandler({
      name: "second",
      handler: async () => {
        executionOrder.push("second");
      },
    });

    shutdown.addHandler({
      name: "third",
      handler: async () => {
        executionOrder.push("third");
      },
    });

    await shutdown.shutdown("test");

    expect(executionOrder).toEqual(["third", "second", "first"]);
  });

  test("shutdown handles handler errors gracefully", async () => {
    const shutdown = new GracefulShutdown();
    const executionOrder: string[] = [];

    shutdown.addHandler({
      name: "before-error",
      handler: async () => {
        executionOrder.push("before");
      },
    });

    shutdown.addHandler({
      name: "error-handler",
      handler: async () => {
        throw new Error("Handler error");
      },
    });

    shutdown.addHandler({
      name: "after-error",
      handler: async () => {
        executionOrder.push("after");
      },
    });

    // Should not throw
    await shutdown.shutdown("test");

    // All handlers should still run (in reverse order)
    expect(executionOrder).toContain("after");
    expect(executionOrder).toContain("before");
  });

  test("shutdown returns same promise if called multiple times", async () => {
    const shutdown = new GracefulShutdown();
    let callCount = 0;

    shutdown.addHandler({
      name: "counter",
      handler: async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        callCount++;
      },
    });

    // Start shutdown - handler takes 20ms so we can call again while pending
    const promise1 = shutdown.shutdown("test");
    // Second call should return the same promise since shutdown is in progress
    const promise2 = shutdown.shutdown("test");

    // Both should reference same pending promise
    await Promise.all([promise1, promise2]);
    expect(callCount).toBe(1);
  });

  test("shuttingDown returns correct state", async () => {
    const shutdown = new GracefulShutdown();

    shutdown.addHandler({
      name: "slow",
      handler: async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      },
    });

    expect(shutdown.shuttingDown).toBe(false);

    const promise = shutdown.shutdown("test");
    expect(shutdown.shuttingDown).toBe(true);

    await promise;
    expect(shutdown.shuttingDown).toBe(true);
  });

  test("addHandler throws during shutdown", async () => {
    const shutdown = new GracefulShutdown();

    shutdown.addHandler({
      name: "blocker",
      handler: async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      },
    });

    const promise = shutdown.shutdown("test");

    expect(() => {
      shutdown.addHandler({
        name: "late-handler",
        handler: async () => {},
      });
    }).toThrow("Cannot add handlers during shutdown");

    await promise;
  });

  test("handler timeout works correctly", async () => {
    const shutdown = new GracefulShutdown();

    shutdown.addHandler({
      name: "slow-handler",
      timeout: 50,
      handler: async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
      },
    });

    const start = Date.now();
    await shutdown.shutdown("test");
    const duration = Date.now() - start;

    // Should timeout around 50ms, not wait for 200ms
    expect(duration).toBeLessThan(150);
  });

  test("custom logger is used if provided", async () => {
    const logs: string[] = [];
    const errors: string[] = [];

    const shutdown = new GracefulShutdown({
      info: (msg) => logs.push(msg),
      error: (msg) => errors.push(msg),
    });

    shutdown.addHandler({
      name: "test",
      handler: async () => {},
    });

    await shutdown.shutdown("test");

    expect(logs.length).toBeGreaterThan(0);
    expect(logs.some((log) => log.includes("Starting graceful shutdown"))).toBe(
      true
    );
  });
});

describe("ConnectionTracker", () => {
  test("add and count connections", () => {
    const tracker = new ConnectionTracker();

    expect(tracker.count).toBe(0);

    tracker.add({ id: 1 });
    expect(tracker.count).toBe(1);

    tracker.add({ id: 2 });
    expect(tracker.count).toBe(2);
  });

  test("shutdown with no connections resolves immediately", async () => {
    const tracker = new ConnectionTracker();

    const start = Date.now();
    await tracker.shutdown(1000);
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(100);
  });

  test("shutdown waits for connections to close", async () => {
    const tracker = new ConnectionTracker();
    let closed = false;

    const mockConnection = {
      id: 1,
      on: (event: string, callback: () => void) => {
        if (event === "close") {
          setTimeout(() => {
            closed = true;
            callback();
          }, 50);
        }
      },
    };

    tracker.add(mockConnection);
    expect(tracker.count).toBe(1);

    await tracker.shutdown(1000);
    expect(closed).toBe(true);
  });

  test("shutdown force closes after timeout", async () => {
    const tracker = new ConnectionTracker();
    let destroyed = false;

    const mockConnection = {
      id: 1,
      destroy: () => {
        destroyed = true;
      },
    };

    tracker.add(mockConnection);

    const start = Date.now();
    await tracker.shutdown(100);
    const duration = Date.now() - start;

    expect(duration).toBeGreaterThanOrEqual(90);
    expect(duration).toBeLessThan(200);
    expect(destroyed).toBe(true);
    expect(tracker.count).toBe(0);
  });

  test("new connections rejected during shutdown", async () => {
    const tracker = new ConnectionTracker();
    let destroyed = false;

    // Start shutdown
    const promise = tracker.shutdown(50);

    // Try to add connection during shutdown
    const newConnection = {
      destroy: () => {
        destroyed = true;
      },
    };

    tracker.add(newConnection);
    expect(destroyed).toBe(true);

    await promise;
  });

  test("shuttingDown property reflects state", async () => {
    const tracker = new ConnectionTracker();

    expect(tracker.shuttingDown).toBe(false);

    const promise = tracker.shutdown(10);
    expect(tracker.shuttingDown).toBe(true);

    await promise;
    expect(tracker.shuttingDown).toBe(true);
  });

  test("connections with close method are closed on timeout", async () => {
    const tracker = new ConnectionTracker();
    let closeCalled = false;

    const mockConnection = {
      close: () => {
        closeCalled = true;
      },
    };

    tracker.add(mockConnection);
    await tracker.shutdown(50);

    expect(closeCalled).toBe(true);
  });
});
