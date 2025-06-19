---
title: Rate Limiting
description: Learn how to implement rate limiting in Verb applications
---

# Rate Limiting

Rate limiting is an essential security feature that helps protect your API from abuse by limiting the number of requests a client can make within a specific time window. Verb provides a simple way to implement rate limiting through its plugin system.

## Basic Rate Limiting

The `@verb/plugin-rate-limit` plugin provides a straightforward way to add rate limiting to your Verb application:

```typescript
import { createServer } from "@verb/server";
import rateLimit from "@verb/plugin-rate-limit";

const app = createServer();

// Apply rate limiting to all routes
app.use(rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: "Too many requests, please try again later"
}));

// Define routes
app.get("/api/data", () => {
  return new Response(JSON.stringify({ message: "Hello, World!" }), {
    headers: { "Content-Type": "application/json" }
  });
});

app.listen(3000);
```

## Configuration Options

The rate limiting plugin accepts the following options:

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `windowMs` | `number` | Time window in milliseconds | `60000` (1 minute) |
| `max` | `number` | Maximum number of requests per window | `100` |
| `message` | `string` | Error message when rate limit is exceeded | `"Too many requests"` |
| `statusCode` | `number` | HTTP status code when rate limit is exceeded | `429` |
| `headers` | `boolean` | Whether to add rate limit headers to responses | `true` |
| `keyGenerator` | `Function` | Function to generate unique keys for clients | IP-based |
| `skip` | `Function` | Function to determine if rate limiting should be skipped | None |
| `store` | `Object` | Custom store implementation | Memory store |

## Route-Specific Rate Limiting

You can apply different rate limits to specific routes:

```typescript
import { createServer } from "@verb/server";
import rateLimit from "@verb/plugin-rate-limit";

const app = createServer();

// Default rate limit for all routes
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 100
}));

// Stricter rate limit for authentication routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 login attempts per 15 minutes
  message: "Too many login attempts, please try again later"
});

app.post("/api/login", authLimiter, async (req) => {
  // Login logic
});

app.listen(3000);
```

## Custom Key Generation

By default, the rate limiter uses the client's IP address as the key. You can customize this behavior:

```typescript
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  keyGenerator: (req) => {
    // Use a combination of IP and User-Agent
    return `${req.headers.get("x-forwarded-for") || req.ip}:${req.headers.get("user-agent")}`;
  }
}));
```

## Custom Store Implementation

For production applications, you might want to use a distributed store like Redis:

```typescript
import { createServer } from "@verb/server";
import rateLimit from "@verb/plugin-rate-limit";
import RedisStore from "@verb/plugin-rate-limit-redis";
import Redis from "ioredis";

const app = createServer();

const client = new Redis({
  host: "redis-server",
  port: 6379
});

app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  store: new RedisStore({
    client: client,
    prefix: "verb-rate-limit:"
  })
}));

app.listen(3000);
```

## Headers

When the `headers` option is enabled (default), the rate limiter adds the following headers to responses:

- `X-RateLimit-Limit`: Maximum number of requests allowed per window
- `X-RateLimit-Remaining`: Number of requests remaining in the current window
- `X-RateLimit-Reset`: Time (in seconds) until the current window resets

## Best Practices

- **Set Reasonable Limits**: Balance security with usability
- **Use Different Limits for Different Routes**: Apply stricter limits to sensitive routes
- **Implement Exponential Backoff**: Increase the waiting time after repeated failures
- **Use a Distributed Store in Production**: For applications running on multiple instances
- **Monitor Rate Limit Events**: Log and analyze rate limit events to detect potential attacks

## Next Steps

- [Security](/server/security) - Learn about other security features in Verb
- [Middleware](/server/middleware) - Learn more about middleware in Verb
- [Plugins](/server/plugins) - Explore other plugins available for Verb