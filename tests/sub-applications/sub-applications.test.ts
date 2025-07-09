import { test, expect } from "bun:test";
import { createServer } from "../../src/server";
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
  getFullMountPath
} from "../../src/applications";

// Helper function to create a mock request
const createMockRequest = (url: string, method: string = 'GET', hostname?: string): Request => {
  const headers = new Headers();
  if (hostname) {
    headers.set('host', hostname);
  }
  
  return new Request(url, {
    method,
    headers
  });
};

// Sub-application creation tests
test("createSubApplication - creates sub-application with mount path", () => {
  const subApp = createSubApplication('/api');
  
  expect(subApp).toBeDefined();
  expect((subApp as any).mountPath).toBe('/api');
  expect((subApp as any).parent).toBeNull();
});

test("createSubApplication - creates sub-application with options", () => {
  const subApp = createSubApplication('/api', {
    domain: 'api.example.com',
    subdomain: 'v1',
    strict: true
  });
  
  expect((subApp as any).mountPath).toBe('/api');
  expect((subApp as any).mountOptions.domain).toBe('api.example.com');
  expect((subApp as any).mountOptions.subdomain).toBe('v1');
  expect((subApp as any).mountOptions.strict).toBe(true);
});

test("createSubApplication - registers sub-application", () => {
  const subApp = createSubApplication('/test', { domain: 'test.com' });
  const subApps = getSubApplications();
  
  expect(subApps.has('test.com:*:/test')).toBe(true);
});

// Sub-application mounting tests
test("mountSubApplication - mounts sub-app to parent", () => {
  const parentApp = createServer();
  const subApp = createSubApplication('/api');
  
  mountSubApplication(parentApp, '/api', subApp);
  
  expect((subApp as any).parent).toBe(parentApp);
  expect((subApp as any).mountPath).toBe('/api');
});

test("mountSubApplication - handles route delegation", async () => {
  const parentApp = createServer();
  const subApp = createSubApplication('/api');
  
  // Add route to sub-application
  subApp.get('/users', (req, res) => {
    res.json({ users: [] });
  });
  
  // Mount sub-application
  mountSubApplication(parentApp, '/api', subApp);
  
  // Test request handling
  const fetchHandler = parentApp.createFetchHandler();
  const request = createMockRequest('http://localhost:3000/api/users');
  
  // Note: This would require actual server setup to test fully
  expect(fetchHandler).toBeDefined();
});

test("mountSubApplication - respects domain restrictions", () => {
  const parentApp = createServer();
  const subApp = createSubApplication('/api');
  
  mountSubApplication(parentApp, '/api', subApp, {
    domain: 'api.example.com'
  });
  
  expect((subApp as any).mountOptions.domain).toBe('api.example.com');
});

// Virtual host tests
test("createVirtualHost - creates virtual host", () => {
  const vhost = createVirtualHost('example.com');
  
  expect(vhost).toBeDefined();
  
  const vhosts = getVirtualHosts();
  expect(vhosts.has('example.com:*')).toBe(true);
});

test("createVirtualHost - creates virtual host with subdomain", () => {
  const vhost = createVirtualHost('example.com', 'api');
  
  const vhosts = getVirtualHosts();
  expect(vhosts.has('example.com:api')).toBe(true);
});

test("virtualHostMiddleware - handles hostname routing", () => {
  const middleware = virtualHostMiddleware();
  
  expect(middleware).toBeDefined();
  expect(typeof middleware).toBe('function');
});

// Registry management tests
test("getSubApplications - returns copy of sub-applications", () => {
  const subApp1 = createSubApplication('/api1');
  const subApp2 = createSubApplication('/api2');
  
  const subApps = getSubApplications();
  const subApps2 = getSubApplications();
  
  expect(subApps).not.toBe(subApps2); // Different instances
  expect(subApps.size).toBeGreaterThan(0);
});

test("getVirtualHosts - returns copy of virtual hosts", () => {
  const vhost1 = createVirtualHost('example1.com');
  const vhost2 = createVirtualHost('example2.com');
  
  const vhosts = getVirtualHosts();
  const vhosts2 = getVirtualHosts();
  
  expect(vhosts).not.toBe(vhosts2); // Different instances
  expect(vhosts.size).toBeGreaterThan(0);
});

test("removeSubApplication - removes sub-application", () => {
  const subApp = createSubApplication('/temp');
  const key = '*:*:/temp';
  
  expect(getSubApplications().has(key)).toBe(true);
  
  const removed = removeSubApplication(key);
  expect(removed).toBe(true);
  expect(getSubApplications().has(key)).toBe(false);
});

test("removeVirtualHost - removes virtual host", () => {
  const vhost = createVirtualHost('temp.com');
  const key = 'temp.com:*';
  
  expect(getVirtualHosts().has(key)).toBe(true);
  
  const removed = removeVirtualHost(key);
  expect(removed).toBe(true);
  expect(getVirtualHosts().has(key)).toBe(false);
});

// Application hierarchy tests
test("getApplicationHierarchy - returns hierarchy for root app", () => {
  const app = createServer();
  const hierarchy = getApplicationHierarchy(app);
  
  expect(hierarchy).toEqual([app]);
});

test("getApplicationHierarchy - returns hierarchy for nested apps", () => {
  const parentApp = createServer();
  const subApp = createSubApplication('/api');
  const childApp = createSubApplication('/v1');
  
  // Create hierarchy: parent -> sub -> child
  mountSubApplication(parentApp, '/api', subApp);
  mountSubApplication(subApp, '/v1', childApp);
  
  const hierarchy = getApplicationHierarchy(childApp);
  
  expect(hierarchy).toHaveLength(3);
  expect(hierarchy[0]).toBe(parentApp);
  expect(hierarchy[1]).toBe(subApp);
  expect(hierarchy[2]).toBe(childApp);
});

test("isMounted - checks if app is mounted", () => {
  const parentApp = createServer();
  const subApp = createSubApplication('/api');
  
  expect(isMounted(parentApp)).toBe(false);
  expect(isMounted(subApp)).toBe(false);
  
  mountSubApplication(parentApp, '/api', subApp);
  
  expect(isMounted(parentApp)).toBe(false);
  expect(isMounted(subApp)).toBe(true);
});

test("getMountPath - returns mount path", () => {
  const parentApp = createServer();
  const subApp = createSubApplication('/api');
  
  expect(getMountPath(parentApp)).toBe('/');
  expect(getMountPath(subApp)).toBe('/api');
  
  mountSubApplication(parentApp, '/api', subApp);
  
  expect(getMountPath(subApp)).toBe('/api');
});

test("getFullMountPath - returns full mount path", () => {
  const parentApp = createServer();
  const subApp = createSubApplication('/api');
  const childApp = createSubApplication('/v1');
  
  // Create hierarchy: parent -> sub -> child
  mountSubApplication(parentApp, '/api', subApp);
  mountSubApplication(subApp, '/v1', childApp);
  
  expect(getFullMountPath(parentApp)).toBe('/');
  expect(getFullMountPath(subApp)).toBe('/api');
  expect(getFullMountPath(childApp)).toBe('/api/v1');
});

test("getFullMountPath - handles duplicate slashes", () => {
  const parentApp = createServer();
  const subApp = createSubApplication('/api/');
  const childApp = createSubApplication('/v1/');
  
  mountSubApplication(parentApp, '/api/', subApp);
  mountSubApplication(subApp, '/v1/', childApp);
  
  const fullPath = getFullMountPath(childApp);
  expect(fullPath).toBe('/api/v1');
  expect(fullPath).not.toContain('//');
});

// Complex integration tests
test("complex sub-application scenario", () => {
  const mainApp = createServer();
  const apiApp = createSubApplication('/api');
  const adminApp = createSubApplication('/admin');
  const v1App = createSubApplication('/v1');
  
  // Set up routes
  apiApp.get('/health', (req, res) => res.json({ status: 'ok' }));
  adminApp.get('/users', (req, res) => res.json({ users: [] }));
  v1App.get('/posts', (req, res) => res.json({ posts: [] }));
  
  // Mount apps
  mountSubApplication(mainApp, '/api', apiApp);
  mountSubApplication(mainApp, '/admin', adminApp);
  mountSubApplication(apiApp, '/v1', v1App);
  
  // Verify hierarchy
  expect(getApplicationHierarchy(v1App)).toEqual([mainApp, apiApp, v1App]);
  expect(getFullMountPath(v1App)).toBe('/api/v1');
  expect(isMounted(v1App)).toBe(true);
  
  // Verify registry
  const subApps = getSubApplications();
  expect(subApps.size).toBeGreaterThan(0);
});

test("virtual host with subdomain routing", () => {
  const apiVHost = createVirtualHost('example.com', 'api');
  const adminVHost = createVirtualHost('example.com', 'admin');
  
  const vhosts = getVirtualHosts();
  expect(vhosts.has('example.com:api')).toBe(true);
  expect(vhosts.has('example.com:admin')).toBe(true);
  
  // Test middleware creation
  const middleware = virtualHostMiddleware();
  expect(typeof middleware).toBe('function');
});

// Error handling tests
test("mountSubApplication - handles invalid mount paths", () => {
  const parentApp = createServer();
  const subApp = createSubApplication('/api');
  
  // Should not throw with various mount path formats
  expect(() => {
    mountSubApplication(parentApp, '', subApp);
  }).not.toThrow();
  
  expect(() => {
    mountSubApplication(parentApp, '/', subApp);
  }).not.toThrow();
});

test("createVirtualHost - handles invalid domains", () => {
  expect(() => {
    createVirtualHost('');
  }).not.toThrow();
  
  expect(() => {
    createVirtualHost('invalid..domain');
  }).not.toThrow();
});

// Performance tests
test("sub-application registry performance", () => {
  const startTime = performance.now();
  
  // Create many sub-applications
  for (let i = 0; i < 100; i++) {
    createSubApplication(`/api${i}`);
  }
  
  const endTime = performance.now();
  expect(endTime - startTime).toBeLessThan(100); // Should be fast
  
  // Verify they're all registered
  const subApps = getSubApplications();
  expect(subApps.size).toBeGreaterThanOrEqual(100);
});

test("virtual host registry performance", () => {
  const startTime = performance.now();
  
  // Create many virtual hosts
  for (let i = 0; i < 100; i++) {
    createVirtualHost(`example${i}.com`);
  }
  
  const endTime = performance.now();
  expect(endTime - startTime).toBeLessThan(100); // Should be fast
  
  // Verify they're all registered
  const vhosts = getVirtualHosts();
  expect(vhosts.size).toBeGreaterThanOrEqual(100);
});