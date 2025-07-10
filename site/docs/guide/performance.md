# Performance

Optimize your Verb applications for maximum performance with caching, connection pooling, and advanced optimization techniques.

## Overview

Performance optimization areas:
- **Caching**: Memory, Redis, and HTTP caching
- **Connection Pooling**: Efficient resource management
- **Compression**: Response compression and optimization
- **Load Balancing**: Distribute traffic across servers
- **Monitoring**: Performance metrics and profiling

## Caching Strategies

### Memory Caching

```typescript
import { createServer } from "verb";

const app = createServer();

// Simple in-memory cache
class MemoryCache {
  constructor(ttl = 300000) { // 5 minutes default
    this.cache = new Map();
    this.ttl = ttl;
  }
  
  set(key, value, customTTL) {
    const expiresAt = Date.now() + (customTTL || this.ttl);
    this.cache.set(key, { value, expiresAt });
    
    // Clean up expired entries periodically
    this.cleanup();
  }
  
  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }
  
  delete(key) {
    this.cache.delete(key);
  }
  
  cleanup() {
    const now = Date.now();
    for (const [key, item] of this.cache) {
      if (now > item.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
  
  size() {
    return this.cache.size;
  }
}

const cache = new MemoryCache();

// Cache middleware
const cacheMiddleware = (ttl = 300000) => {
  return (req, res, next) => {
    if (req.method !== "GET") return next();
    
    const key = `${req.method}:${req.url}`;
    const cached = cache.get(key);
    
    if (cached) {
      res.header("X-Cache", "HIT");
      return res.json(cached);
    }
    
    // Override res.json to cache the response
    const originalJson = res.json.bind(res);
    res.json = function(data) {
      cache.set(key, data, ttl);
      res.header("X-Cache", "MISS");
      return originalJson(data);
    };
    
    next();
  };
};

// Apply caching to specific routes
app.get("/api/users", cacheMiddleware(600000), async (req, res) => {
  const users = await getUsersFromDatabase();
  res.json(users);
});
```

### Redis Caching

```typescript
import { Redis } from "ioredis";

const redis = new Redis({
  host: "localhost",
  port: 6379,
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  lazyConnect: true
});

class RedisCache {
  constructor(client) {
    this.client = client;
  }
  
  async set(key, value, ttl = 300) {
    try {
      const serialized = JSON.stringify(value);
      await this.client.setex(key, ttl, serialized);
    } catch (error) {
      console.error("Redis set error:", error);
    }
  }
  
  async get(key) {
    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error("Redis get error:", error);
      return null;
    }
  }
  
  async delete(key) {
    try {
      await this.client.del(key);
    } catch (error) {
      console.error("Redis delete error:", error);
    }
  }
  
  async invalidatePattern(pattern) {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } catch (error) {
      console.error("Redis pattern delete error:", error);
    }
  }
}

const redisCache = new RedisCache(redis);

// Redis cache middleware
const redisCacheMiddleware = (ttl = 300) => {
  return async (req, res, next) => {
    if (req.method !== "GET") return next();
    
    const key = `cache:${req.method}:${req.url}`;
    
    try {
      const cached = await redisCache.get(key);
      if (cached) {
        res.header("X-Cache", "HIT");
        res.header("X-Cache-TTL", await redis.ttl(key));
        return res.json(cached);
      }
    } catch (error) {
      console.error("Cache lookup error:", error);
    }
    
    // Override res.json to cache the response
    const originalJson = res.json.bind(res);
    res.json = function(data) {
      redisCache.set(key, data, ttl).catch(console.error);
      res.header("X-Cache", "MISS");
      return originalJson(data);
    };
    
    next();
  };
};

app.get("/api/popular-posts", redisCacheMiddleware(3600), async (req, res) => {
  const posts = await getPopularPosts();
  res.json(posts);
});
```

### HTTP Caching

```typescript
// HTTP caching headers middleware
const httpCache = (options = {}) => {
  return (req, res, next) => {
    const {
      maxAge = 3600, // 1 hour
      mustRevalidate = false,
      private = false,
      immutable = false
    } = options;
    
    let cacheControl = private ? "private" : "public";
    cacheControl += `, max-age=${maxAge}`;
    
    if (mustRevalidate) {
      cacheControl += ", must-revalidate";
    }
    
    if (immutable) {
      cacheControl += ", immutable";
    }
    
    res.header("Cache-Control", cacheControl);
    
    // ETag support
    const originalJson = res.json.bind(res);
    res.json = function(data) {
      const etag = `"${generateETag(data)}"`;
      res.header("ETag", etag);
      
      // Check if client has current version
      const clientETag = req.headers.get("if-none-match");
      if (clientETag === etag) {
        return res.status(304).end();
      }
      
      return originalJson(data);
    };
    
    next();
  };
};

function generateETag(data) {
  return require("crypto")
    .createHash("md5")
    .update(JSON.stringify(data))
    .digest("hex");
}

// Apply HTTP caching
app.get("/api/config", httpCache({ maxAge: 86400, immutable: true }), (req, res) => {
  res.json(getAppConfig());
});

app.get("/api/news", httpCache({ maxAge: 1800, mustRevalidate: true }), (req, res) => {
  res.json(getLatestNews());
});
```

## Connection Pooling

### Database Connection Pool

```typescript
import { Database } from "bun:sqlite";

class DatabasePool {
  constructor(options = {}) {
    this.maxConnections = options.maxConnections || 10;
    this.idleTimeout = options.idleTimeout || 30000;
    this.connections = [];
    this.activeConnections = new Set();
    this.waitingQueue = [];
  }
  
  async getConnection() {
    // Try to get an existing idle connection
    let connection = this.connections.pop();
    
    if (!connection && this.activeConnections.size < this.maxConnections) {
      // Create new connection if under limit
      connection = new Database("app.db");
      connection.lastUsed = Date.now();
    }
    
    if (connection) {
      this.activeConnections.add(connection);
      return connection;
    }
    
    // Wait for a connection to become available
    return new Promise((resolve) => {
      this.waitingQueue.push(resolve);
    });
  }
  
  releaseConnection(connection) {
    this.activeConnections.delete(connection);
    connection.lastUsed = Date.now();
    
    // Check if anyone is waiting
    if (this.waitingQueue.length > 0) {
      const resolve = this.waitingQueue.shift();
      this.activeConnections.add(connection);
      resolve(connection);
    } else {
      this.connections.push(connection);
    }
  }
  
  // Clean up idle connections
  cleanup() {
    const now = Date.now();
    this.connections = this.connections.filter(conn => {
      if (now - conn.lastUsed > this.idleTimeout) {
        conn.close();
        return false;
      }
      return true;
    });
  }
  
  async query(sql, params = []) {
    const connection = await this.getConnection();
    try {
      const statement = connection.prepare(sql);
      const result = statement.all(...params);
      return result;
    } finally {
      this.releaseConnection(connection);
    }
  }
}

const dbPool = new DatabasePool({ maxConnections: 10, idleTimeout: 30000 });

// Cleanup idle connections periodically
setInterval(() => dbPool.cleanup(), 60000);

// Usage in routes
app.get("/api/users", async (req, res) => {
  try {
    const users = await dbPool.query("SELECT * FROM users WHERE active = ?", [true]);
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: "Database error" });
  }
});
```

### HTTP Client Pool

```typescript
class HTTPClientPool {
  constructor(options = {}) {
    this.maxConnections = options.maxConnections || 20;
    this.timeout = options.timeout || 30000;
    this.keepAlive = options.keepAlive !== false;
    this.connections = new Map(); // baseURL -> connection pool
  }
  
  async fetch(url, options = {}) {
    const urlObj = new URL(url);
    const baseURL = `${urlObj.protocol}//${urlObj.host}`;
    
    if (!this.connections.has(baseURL)) {
      this.connections.set(baseURL, {
        active: 0,
        queue: []
      });
    }
    
    const pool = this.connections.get(baseURL);
    
    if (pool.active >= this.maxConnections) {
      // Wait for an available slot
      await new Promise(resolve => pool.queue.push(resolve));
    }
    
    pool.active++;
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(this.timeout)
      });
      return response;
    } finally {
      pool.active--;
      
      // Process queue
      if (pool.queue.length > 0) {
        const resolve = pool.queue.shift();
        resolve();
      }
    }
  }
}

const httpClient = new HTTPClientPool({ maxConnections: 50, timeout: 10000 });

app.get("/api/external-data", async (req, res) => {
  try {
    const response = await httpClient.fetch("https://api.example.com/data");
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "External API error" });
  }
});
```

## Response Compression

```typescript
import { gzip, deflate } from "zlib";
import { promisify } from "util";

const gzipAsync = promisify(gzip);
const deflateAsync = promisify(deflate);

const compression = (options = {}) => {
  const threshold = options.threshold || 1024; // 1KB
  const level = options.level || 6; // Compression level 1-9
  
  return async (req, res, next) => {
    const acceptEncoding = req.headers.get("accept-encoding") || "";
    const supportsGzip = acceptEncoding.includes("gzip");
    const supportsDeflate = acceptEncoding.includes("deflate");
    
    if (!supportsGzip && !supportsDeflate) {
      return next();
    }
    
    // Override res.json to compress responses
    const originalJson = res.json.bind(res);
    res.json = async function(data) {
      const json = JSON.stringify(data);
      const buffer = Buffer.from(json, "utf8");
      
      if (buffer.length < threshold) {
        return originalJson(data);
      }
      
      try {
        let compressed;
        let encoding;
        
        if (supportsGzip) {
          compressed = await gzipAsync(buffer, { level });
          encoding = "gzip";
        } else if (supportsDeflate) {
          compressed = await deflateAsync(buffer, { level });
          encoding = "deflate";
        }
        
        if (compressed && compressed.length < buffer.length) {
          res.header("Content-Encoding", encoding);
          res.header("Content-Length", compressed.length.toString());
          res.header("Content-Type", "application/json");
          return res.end(compressed);
        }
      } catch (error) {
        console.error("Compression error:", error);
      }
      
      return originalJson(data);
    };
    
    next();
  };
};

app.use(compression({ threshold: 1024, level: 6 }));
```

## Load Balancing

```typescript
class LoadBalancer {
  constructor(servers, strategy = "round-robin") {
    this.servers = servers.map(server => ({
      ...server,
      healthy: true,
      connections: 0,
      responseTime: 0
    }));
    this.strategy = strategy;
    this.currentIndex = 0;
  }
  
  getServer() {
    const healthyServers = this.servers.filter(s => s.healthy);
    
    if (healthyServers.length === 0) {
      throw new Error("No healthy servers available");
    }
    
    switch (this.strategy) {
      case "round-robin":
        return this.roundRobin(healthyServers);
      case "least-connections":
        return this.leastConnections(healthyServers);
      case "weighted":
        return this.weighted(healthyServers);
      case "response-time":
        return this.responseTime(healthyServers);
      default:
        return this.roundRobin(healthyServers);
    }
  }
  
  roundRobin(servers) {
    const server = servers[this.currentIndex % servers.length];
    this.currentIndex++;
    return server;
  }
  
  leastConnections(servers) {
    return servers.reduce((min, server) =>
      server.connections < min.connections ? server : min
    );
  }
  
  weighted(servers) {
    const totalWeight = servers.reduce((sum, s) => sum + (s.weight || 1), 0);
    let random = Math.random() * totalWeight;
    
    for (const server of servers) {
      random -= (server.weight || 1);
      if (random <= 0) return server;
    }
    
    return servers[0];
  }
  
  responseTime(servers) {
    return servers.reduce((min, server) =>
      server.responseTime < min.responseTime ? server : min
    );
  }
  
  async healthCheck() {
    for (const server of this.servers) {
      try {
        const start = Date.now();
        const response = await fetch(`${server.url}/health`, {
          timeout: 5000
        });
        
        server.healthy = response.ok;
        server.responseTime = Date.now() - start;
      } catch (error) {
        server.healthy = false;
        server.responseTime = Infinity;
      }
    }
  }
  
  startHealthChecks(interval = 30000) {
    setInterval(() => this.healthCheck(), interval);
    this.healthCheck(); // Initial check
  }
}

const loadBalancer = new LoadBalancer([
  { url: "http://server1:3000", weight: 3 },
  { url: "http://server2:3000", weight: 2 },
  { url: "http://server3:3000", weight: 1 }
], "weighted");

loadBalancer.startHealthChecks();

app.use("/api/", async (req, res, next) => {
  try {
    const server = loadBalancer.getServer();
    server.connections++;
    
    const response = await fetch(`${server.url}${req.url}`, {
      method: req.method,
      headers: req.headers,
      body: req.method !== "GET" ? req.body : undefined
    });
    
    server.connections--;
    
    // Proxy response
    for (const [key, value] of response.headers) {
      res.header(key, value);
    }
    
    res.status(response.status);
    res.end(await response.arrayBuffer());
  } catch (error) {
    next(error);
  }
});
```

## Performance Monitoring

```typescript
class PerformanceMonitor {
  constructor() {
    this.metrics = {
      requests: 0,
      responses: 0,
      errors: 0,
      totalResponseTime: 0,
      activeSessions: 0
    };
    this.responseTimeHistogram = new Map();
    this.errorRates = [];
  }
  
  middleware() {
    return (req, res, next) => {
      const startTime = Date.now();
      this.metrics.requests++;
      this.metrics.activeSessions++;
      
      res.on("finish", () => {
        const responseTime = Date.now() - startTime;
        this.metrics.responses++;
        this.metrics.totalResponseTime += responseTime;
        this.metrics.activeSessions--;
        
        // Track response times
        const bucket = this.getResponseTimeBucket(responseTime);
        this.responseTimeHistogram.set(bucket, 
          (this.responseTimeHistogram.get(bucket) || 0) + 1);
        
        // Track error rates
        if (res.statusCode >= 400) {
          this.metrics.errors++;
        }
        
        // Add performance headers
        res.header("X-Response-Time", `${responseTime}ms`);
      });
      
      next();
    };
  }
  
  getResponseTimeBucket(time) {
    if (time < 100) return "0-100ms";
    if (time < 500) return "100-500ms";
    if (time < 1000) return "500ms-1s";
    if (time < 5000) return "1s-5s";
    return "5s+";
  }
  
  getStats() {
    const avgResponseTime = this.metrics.responses > 0 
      ? this.metrics.totalResponseTime / this.metrics.responses 
      : 0;
    
    const errorRate = this.metrics.requests > 0 
      ? (this.metrics.errors / this.metrics.requests) * 100 
      : 0;
    
    return {
      requests: this.metrics.requests,
      responses: this.metrics.responses,
      errors: this.metrics.errors,
      activeSessions: this.metrics.activeSessions,
      avgResponseTime: Math.round(avgResponseTime),
      errorRate: Math.round(errorRate * 100) / 100,
      responseTimeDistribution: Object.fromEntries(this.responseTimeHistogram),
      memory: process.memoryUsage(),
      uptime: process.uptime()
    };
  }
  
  reset() {
    this.metrics = {
      requests: 0,
      responses: 0,
      errors: 0,
      totalResponseTime: 0,
      activeSessions: this.metrics.activeSessions // Keep active sessions
    };
    this.responseTimeHistogram.clear();
  }
}

const monitor = new PerformanceMonitor();
app.use(monitor.middleware());

// Metrics endpoint
app.get("/metrics", (req, res) => {
  res.json(monitor.getStats());
});

// Performance alerts
setInterval(() => {
  const stats = monitor.getStats();
  
  if (stats.avgResponseTime > 2000) {
    console.warn(`High response time: ${stats.avgResponseTime}ms`);
  }
  
  if (stats.errorRate > 5) {
    console.warn(`High error rate: ${stats.errorRate}%`);
  }
  
  if (stats.activeSessions > 1000) {
    console.warn(`High concurrent sessions: ${stats.activeSessions}`);
  }
}, 60000);
```

## Optimization Techniques

### Lazy Loading

```typescript
class LazyModule {
  constructor(importFn) {
    this.importFn = importFn;
    this.module = null;
    this.loading = false;
    this.loadPromise = null;
  }
  
  async load() {
    if (this.module) return this.module;
    
    if (this.loading) return this.loadPromise;
    
    this.loading = true;
    this.loadPromise = this.importFn().then(module => {
      this.module = module;
      this.loading = false;
      return module;
    });
    
    return this.loadPromise;
  }
}

// Lazy load heavy modules
const imageProcessor = new LazyModule(() => import("sharp"));
const pdfGenerator = new LazyModule(() => import("puppeteer"));

app.post("/api/process-image", async (req, res) => {
  const sharp = await imageProcessor.load();
  // Process image with sharp
});

app.post("/api/generate-pdf", async (req, res) => {
  const puppeteer = await pdfGenerator.load();
  // Generate PDF with puppeteer
});
```

### Memory Management

```typescript
class MemoryManager {
  constructor() {
    this.gcThreshold = 0.8; // Trigger GC at 80% memory usage
    this.checkInterval = 30000; // Check every 30 seconds
    this.startMonitoring();
  }
  
  startMonitoring() {
    setInterval(() => {
      const usage = process.memoryUsage();
      const heapUsedPercent = usage.heapUsed / usage.heapTotal;
      
      if (heapUsedPercent > this.gcThreshold) {
        console.log(`Memory usage high (${Math.round(heapUsedPercent * 100)}%), triggering GC`);
        if (global.gc) {
          global.gc();
        }
      }
      
      // Log memory stats
      console.log(`Memory: ${Math.round(usage.heapUsed / 1024 / 1024)}MB / ${Math.round(usage.heapTotal / 1024 / 1024)}MB`);
    }, this.checkInterval);
  }
  
  cleanup() {
    // Clean up application-specific resources
    cache.cleanup();
    dbPool.cleanup();
  }
}

const memoryManager = new MemoryManager();

// Cleanup on shutdown
process.on("SIGTERM", () => {
  memoryManager.cleanup();
  process.exit(0);
});
```

## Best Practices

1. **Implement Caching**: Use multiple cache layers
2. **Pool Connections**: Reuse database and HTTP connections
3. **Compress Responses**: Use gzip/deflate compression
4. **Monitor Performance**: Track key metrics
5. **Optimize Queries**: Use efficient database queries
6. **Lazy Load**: Load modules and resources on demand
7. **Memory Management**: Monitor and manage memory usage
8. **Load Balance**: Distribute traffic across servers
9. **Use CDN**: Serve static assets from CDN
10. **Profile Code**: Identify performance bottlenecks

## Performance Checklist

- [ ] Response caching implemented
- [ ] Database connection pooling
- [ ] HTTP compression enabled
- [ ] Static assets optimized
- [ ] Database queries optimized
- [ ] Memory usage monitored
- [ ] Load balancing configured
- [ ] Performance metrics tracked
- [ ] Error rates monitored
- [ ] Resource limits set

## Next Steps

- [Testing](/guide/testing) - Performance testing strategies
- [Security](/guide/security) - Performance vs security tradeoffs