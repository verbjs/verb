import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import {
  createSubApplication,
  mountSubApplication,
  createVirtualHost,
  virtualHostMiddleware,
  getSubApplications,
  getVirtualHosts,
  removeSubApplication,
  removeVirtualHost,
  getApplicationHierarchy,
  isMounted,
  getMountPath,
  getFullMountPath,
} from "../../src/applications";
import { createServer } from "../../src/server";

describe("Sub-Applications", () => {
  afterEach(() => {
    // Clean up registries
    const subApps = getSubApplications();
    for (const key of subApps.keys()) {
      removeSubApplication(key);
    }
    const vhosts = getVirtualHosts();
    for (const key of vhosts.keys()) {
      removeVirtualHost(key);
    }
  });

  test("createSubApplication creates a server with mount info", () => {
    const subApp = createSubApplication("/api");

    expect(subApp).toBeDefined();
    expect((subApp as any).mountPath).toBe("/api");
    expect((subApp as any).parent).toBeNull();
  });

  test("createSubApplication with options", () => {
    const subApp = createSubApplication("/api", {
      domain: "example.com",
      subdomain: "api",
      strict: true,
    });

    expect((subApp as any).mountPath).toBe("/api");
    expect((subApp as any).mountOptions.domain).toBe("example.com");
    expect((subApp as any).mountOptions.subdomain).toBe("api");
    expect((subApp as any).mountOptions.strict).toBe(true);
  });

  test("createSubApplication registers in registry", () => {
    createSubApplication("/api");

    const apps = getSubApplications();
    expect(apps.size).toBeGreaterThan(0);
  });

  test("mountSubApplication sets parent relationship", () => {
    const parentApp = createServer();
    const childApp = createServer();

    mountSubApplication(parentApp, "/api", childApp);

    expect((childApp as any).parent).toBe(parentApp);
    expect((childApp as any).mountPath).toBe("/api");
  });

  test("mountSubApplication with domain restriction", () => {
    const parentApp = createServer();
    const childApp = createServer();

    mountSubApplication(parentApp, "/api", childApp, {
      domain: "api.example.com",
    });

    expect((childApp as any).mountOptions.domain).toBe("api.example.com");
  });

  test("mountSubApplication with subdomain restriction", () => {
    const parentApp = createServer();
    const childApp = createServer();

    mountSubApplication(parentApp, "/", childApp, {
      subdomain: "api",
    });

    expect((childApp as any).mountOptions.subdomain).toBe("api");
  });

  test("mountSubApplication with mergeParams", () => {
    const parentApp = createServer();
    const childApp = createServer();

    mountSubApplication(parentApp, "/users/:userId", childApp, {
      mergeParams: true,
    });

    expect((childApp as any).mountOptions.mergeParams).toBe(true);
  });
});

describe("Virtual Hosts", () => {
  afterEach(() => {
    const vhosts = getVirtualHosts();
    for (const key of vhosts.keys()) {
      removeVirtualHost(key);
    }
  });

  test("createVirtualHost creates a server for domain", () => {
    const vhost = createVirtualHost("example.com");

    expect(vhost).toBeDefined();
    expect(vhost.get).toBeDefined();
    expect(vhost.post).toBeDefined();
  });

  test("createVirtualHost with subdomain", () => {
    const vhost = createVirtualHost("example.com", "api");

    expect(vhost).toBeDefined();
  });

  test("createVirtualHost registers in registry", () => {
    createVirtualHost("example.com");

    const hosts = getVirtualHosts();
    expect(hosts.size).toBeGreaterThan(0);
  });

  test("virtualHostMiddleware returns middleware function", () => {
    const middleware = virtualHostMiddleware();

    expect(typeof middleware).toBe("function");
  });
});

describe("Registry Management", () => {
  afterEach(() => {
    const subApps = getSubApplications();
    for (const key of subApps.keys()) {
      removeSubApplication(key);
    }
    const vhosts = getVirtualHosts();
    for (const key of vhosts.keys()) {
      removeVirtualHost(key);
    }
  });

  test("getSubApplications returns copy of registry", () => {
    createSubApplication("/api");
    createSubApplication("/admin");

    const apps1 = getSubApplications();
    const apps2 = getSubApplications();

    expect(apps1).not.toBe(apps2);
    expect(apps1.size).toBe(apps2.size);
  });

  test("getVirtualHosts returns copy of registry", () => {
    createVirtualHost("example.com");
    createVirtualHost("api.example.com");

    const hosts1 = getVirtualHosts();
    const hosts2 = getVirtualHosts();

    expect(hosts1).not.toBe(hosts2);
    expect(hosts1.size).toBe(hosts2.size);
  });

  test("removeSubApplication removes from registry", () => {
    createSubApplication("/api");

    const beforeSize = getSubApplications().size;
    const removed = removeSubApplication("*:*:/api");
    const afterSize = getSubApplications().size;

    expect(removed).toBe(true);
    expect(afterSize).toBe(beforeSize - 1);
  });

  test("removeSubApplication returns false for non-existent key", () => {
    const removed = removeSubApplication("nonexistent");
    expect(removed).toBe(false);
  });

  test("removeVirtualHost removes from registry", () => {
    createVirtualHost("example.com");

    const beforeSize = getVirtualHosts().size;
    const removed = removeVirtualHost("example.com:*");
    const afterSize = getVirtualHosts().size;

    expect(removed).toBe(true);
    expect(afterSize).toBe(beforeSize - 1);
  });
});

describe("Application Hierarchy Utilities", () => {
  test("getApplicationHierarchy returns array with single app", () => {
    const app = createServer();

    const hierarchy = getApplicationHierarchy(app);

    expect(hierarchy).toHaveLength(1);
    expect(hierarchy[0]).toBe(app);
  });

  test("getApplicationHierarchy returns full hierarchy", () => {
    const root = createServer();
    const child = createServer();
    const grandchild = createServer();

    mountSubApplication(root, "/api", child);
    mountSubApplication(child, "/v1", grandchild);

    const hierarchy = getApplicationHierarchy(grandchild);

    expect(hierarchy).toHaveLength(3);
    expect(hierarchy[0]).toBe(root);
    expect(hierarchy[1]).toBe(child);
    expect(hierarchy[2]).toBe(grandchild);
  });

  test("isMounted returns false for root app", () => {
    const app = createServer();

    expect(isMounted(app)).toBe(false);
  });

  test("isMounted returns true for mounted app", () => {
    const parent = createServer();
    const child = createServer();

    mountSubApplication(parent, "/api", child);

    expect(isMounted(child)).toBe(true);
    expect(isMounted(parent)).toBe(false);
  });

  test("getMountPath returns mount path", () => {
    const parent = createServer();
    const child = createServer();

    mountSubApplication(parent, "/api", child);

    expect(getMountPath(child)).toBe("/api");
  });

  test("getMountPath returns / for root app", () => {
    const app = createServer();

    expect(getMountPath(app)).toBe("/");
  });

  test("getFullMountPath returns full path for nested apps", () => {
    const root = createServer();
    const child = createServer();
    const grandchild = createServer();

    mountSubApplication(root, "/api", child);
    mountSubApplication(child, "/v1", grandchild);

    expect(getFullMountPath(grandchild)).toBe("/api/v1");
  });

  test("getFullMountPath returns / for root app", () => {
    const app = createServer();

    expect(getFullMountPath(app)).toBe("/");
  });

  test("getFullMountPath normalizes double slashes", () => {
    const root = createServer();
    const child = createServer();

    mountSubApplication(root, "/api/", child);

    const path = getFullMountPath(child);
    expect(path).not.toContain("//");
  });
});
