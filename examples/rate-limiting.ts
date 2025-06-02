import {
  createServer,
  json,
  rateLimit,
  rateLimitByIP,
  rateLimitByEndpoint,
  rateLimitByUser,
  strictRateLimit,
  MemoryStore,
  SlidingWindowStore,
  TokenBucketStore,
  type RateLimitOptions
} from "../src/index.ts";

const app = createServer({ port: 3003 });

// Global rate limiting (100 requests per 15 minutes)
app.use(rateLimit({
  max: 100,
  windowMs: 15 * 60 * 1000,
  message: 'Too many requests from this IP, please try again later'
}));

// Root endpoint with rate limiting information
app.get('/', () => {
  return json({
    message: 'Rate Limiting Demo',
    globalLimits: {
      requests: 100,
      window: '15 minutes',
      strategy: 'sliding-window'
    },
    endpoints: {
      'GET /basic': 'Basic rate limiting demo',
      'GET /ip-limited': 'IP-based rate limiting (20/min)',
      'GET /endpoint-limited': 'Endpoint-specific limiting (10/min)',
      'GET /user-limited': 'User-based limiting (requires x-user-id header)',
      'POST /strict': 'Strict rate limiting for sensitive operations (3/min)',
      'GET /strategies': 'Different rate limiting strategies',
      'GET /stats': 'Rate limiting statistics',
      'POST /burst': 'Burst testing endpoint'
    },
    testingTips: [
      'Make multiple requests quickly to trigger rate limits',
      'Check X-RateLimit-* headers in responses',
      'Use different IPs or user IDs to test isolation',
      'Try the /burst endpoint for rapid testing'
    ]
  });
});

// Basic rate limiting demonstration
app.get('/basic', () => {
  return json({
    message: 'Basic rate limiting endpoint',
    note: 'This endpoint uses the global rate limiter',
    limits: {
      global: '100 requests per 15 minutes'
    },
    timestamp: new Date().toISOString()
  });
});

// IP-based rate limiting (stricter than global)
const ipRateLimiter = rateLimitByIP(20, 60 * 1000); // 20 requests per minute

app.get('/ip-limited', async (req) => {
  // Apply IP rate limiter manually
  try {
    await ipRateLimiter(req, async () => new Response());
  } catch (error) {
    return json({ error: 'IP rate limit exceeded (20/min)' }, 429);
  }
  return json({
    message: 'IP-based rate limited endpoint',
    limits: {
      global: '100 requests per 15 minutes',
      ipSpecific: '20 requests per minute'
    },
    note: 'This endpoint has additional IP-based limiting',
    yourIP: 'Check X-Forwarded-For or X-Real-IP headers',
    timestamp: new Date().toISOString()
  });
});

// Endpoint-specific rate limiting
const endpointRateLimiter = rateLimitByEndpoint(10, 60 * 1000); // 10 requests per minute

app.get('/endpoint-limited', async (req) => {
  // Apply endpoint rate limiter manually
  try {
    await endpointRateLimiter(req, async () => new Response());
  } catch (error) {
    return json({ error: 'Endpoint rate limit exceeded (10/min)' }, 429);
  }
  return json({
    message: 'Endpoint-specific rate limited',
    limits: {
      global: '100 requests per 15 minutes',
      endpointSpecific: '10 requests per minute'
    },
    note: 'Rate limit is per IP + endpoint combination',
    timestamp: new Date().toISOString()
  });
});

// User-based rate limiting
const userRateLimiter = rateLimitByUser(50, 60 * 1000); // 50 requests per minute per user

app.get('/user-limited', async (req) => {
  // Apply user rate limiter manually
  try {
    await userRateLimiter(req, async () => new Response());
  } catch (error) {
    return json({ error: 'User rate limit exceeded (50/min)' }, 429);
  }
  const userId = req.headers.get('x-user-id');
  
  return json({
    message: 'User-based rate limited endpoint',
    limits: {
      global: '100 requests per 15 minutes',
      userSpecific: '50 requests per minute per user'
    },
    note: 'Provide x-user-id header to test user-specific limiting',
    yourUserId: userId || 'No user ID provided (using IP fallback)',
    instructions: 'Add header: x-user-id: your-user-id',
    timestamp: new Date().toISOString()
  });
});

// Strict rate limiting for sensitive operations
const strictLimiter = strictRateLimit(3, 60 * 1000); // 3 requests per minute

app.post('/strict', async (req) => {
  // Apply strict rate limiter manually
  try {
    await strictLimiter(req, async () => new Response());
  } catch (error) {
    return json({ error: 'Strict rate limit exceeded (3/min)' }, 429);
  }
  try {
    const body = await req.json();
    
    return json({
      message: 'Sensitive operation completed',
      limits: {
        global: '100 requests per 15 minutes',
        strict: '3 requests per minute (very restrictive)'
      },
      received: body,
      warning: 'This endpoint simulates sensitive operations like password reset',
      timestamp: new Date().toISOString()
    });
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
});

// Different rate limiting strategies demonstration
app.get('/strategies', async (req) => {
  const strategy = req.url.includes('?strategy=') ? 
    new URL(req.url).searchParams.get('strategy') : 'memory';

  let limiter;
  let description;

  switch (strategy) {
    case 'sliding':
      limiter = rateLimit({
        max: 5,
        windowMs: 30 * 1000, // 30 seconds
        strategy: 'sliding-window',
        store: new SlidingWindowStore()
      });
      description = 'Sliding window: Smoothly distributed requests over time';
      break;
    
    case 'token':
      limiter = rateLimit({
        max: 5,
        windowMs: 30 * 1000,
        strategy: 'token-bucket',
        store: new TokenBucketStore(5, 5/30) // 5 tokens, refill at 5 per 30 seconds
      });
      description = 'Token bucket: Allows bursts but limits sustained rate';
      break;
    
    case 'memory':
    default:
      limiter = rateLimit({
        max: 5,
        windowMs: 30 * 1000,
        strategy: 'fixed-window',
        store: new MemoryStore()
      });
      description = 'Fixed window: Traditional time-based windows';
      break;
  }

  // Apply the specific limiter
  try {
    await limiter(req, async () => new Response());
  } catch (error) {
    return json({
      error: 'Rate limit exceeded',
      strategy,
      description,
      resetTime: Date.now() + 30000
    }, 429);
  }

  return json({
    message: 'Strategy demonstration',
    strategy,
    description,
    limits: '5 requests per 30 seconds',
    availableStrategies: {
      memory: '/strategies?strategy=memory',
      sliding: '/strategies?strategy=sliding',
      token: '/strategies?strategy=token'
    },
    timestamp: new Date().toISOString()
  });
});

// Rate limiting statistics
app.get('/stats', () => {
  return json({
    message: 'Rate limiting statistics',
    note: 'In production, you would integrate with your rate limit stores',
    mockStats: {
      totalRequests: Math.floor(Math.random() * 10000),
      rateLimitedRequests: Math.floor(Math.random() * 100),
      activeKeys: Math.floor(Math.random() * 50),
      strategies: {
        'fixed-window': { usage: '60%', performance: 'high' },
        'sliding-window': { usage: '30%', performance: 'medium' },
        'token-bucket': { usage: '10%', performance: 'medium' }
      }
    },
    recommendations: [
      'Monitor rate limiting metrics in production',
      'Adjust limits based on actual usage patterns',
      'Use sliding window for smoother user experience',
      'Use token bucket for APIs that need burst capability',
      'Implement whitelist for trusted clients'
    ],
    timestamp: new Date().toISOString()
  });
});

// Burst testing endpoint
app.post('/burst', () => {
  const burstId = Math.random().toString(36).substring(7);
  
  return json({
    message: 'Burst test endpoint',
    burstId,
    note: 'Make many rapid requests to this endpoint to test rate limiting',
    suggestion: 'Use: for i in {1..20}; do curl -X POST http://localhost:3003/burst; done',
    limits: 'Subject to global rate limiting (100/15min)',
    timestamp: new Date().toISOString()
  });
});

// Rate limit bypass demonstration (for testing)
app.get('/bypass', (req) => {
  const bypassKey = req.headers.get('x-bypass-key');
  
  if (bypassKey === 'demo-bypass-key') {
    return json({
      message: 'Rate limit bypassed',
      note: 'This demonstrates how to implement bypass logic',
      implementation: 'Check for special header or whitelist in skip function',
      timestamp: new Date().toISOString()
    });
  }
  
  return json({
    message: 'Bypass demonstration',
    note: 'Add header x-bypass-key: demo-bypass-key to bypass rate limits',
    currentBypassKey: bypassKey || 'none provided',
    timestamp: new Date().toISOString()
  });
});

// Custom rate limiting with specific configuration
const customLimiter = rateLimit({
  max: 15,
  windowMs: 60 * 1000,
  keyGenerator: (req) => {
    // Custom key generation based on multiple factors
    const ip = req.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';
    const endpoint = new URL(req.url).pathname;
    return `${ip}:${userAgent.substring(0, 10)}:${endpoint}`;
  },
  onLimitReached: (req, info) => {
    console.log(`🚨 Rate limit exceeded for custom key at ${new Date().toISOString()}`, {
      totalHits: info.totalHits,
      remaining: info.remaining,
      resetTime: new Date(info.resetTime).toISOString()
    });
  },
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.url.includes('/health');
  }
});

app.get('/custom', async (req) => {
  // Apply custom rate limiter manually
  try {
    await customLimiter(req, async () => new Response());
  } catch (error) {
    return json({ error: 'Custom rate limit exceeded (15/min)' }, 429);
  }
  return json({
    message: 'Custom rate limiting',
    features: [
      'Custom key generation (IP + User-Agent + Endpoint)',
      'Custom onLimitReached callback for logging',
      'Skip function for health checks',
      'Custom window and limits'
    ],
    limits: '15 requests per minute with custom key',
    timestamp: new Date().toISOString()
  });
});

// Health check (bypassed by custom limiter)
app.get('/health', () => {
  return json({
    status: 'healthy',
    message: 'This endpoint bypasses rate limiting',
    timestamp: new Date().toISOString()
  });
});

console.log(`
🚦 Rate Limiting Demo Server Started!

Test the rate limiting features:

1. Basic Rate Limiting:
   for i in {1..10}; do curl http://localhost:3003/basic; echo; done

2. IP-Based Limiting (20/min):
   for i in {1..25}; do curl http://localhost:3003/ip-limited; echo; done

3. Endpoint-Specific Limiting (10/min):
   for i in {1..15}; do curl http://localhost:3003/endpoint-limited; echo; done

4. User-Based Limiting:
   for i in {1..10}; do curl -H "x-user-id: user1" http://localhost:3003/user-limited; echo; done
   for i in {1..10}; do curl -H "x-user-id: user2" http://localhost:3003/user-limited; echo; done

5. Strict Limiting (3/min):
   for i in {1..5}; do curl -X POST -H "Content-Type: application/json" -d '{"test":true}' http://localhost:3003/strict; echo; done

6. Different Strategies:
   curl "http://localhost:3003/strategies?strategy=sliding"
   curl "http://localhost:3003/strategies?strategy=token"
   curl "http://localhost:3003/strategies?strategy=memory"

7. Burst Testing:
   for i in {1..30}; do curl -X POST http://localhost:3003/burst; done

8. Rate Limit Bypass:
   curl -H "x-bypass-key: demo-bypass-key" http://localhost:3003/bypass

9. Custom Rate Limiting:
   for i in {1..20}; do curl http://localhost:3003/custom; echo; done

10. Health Check (bypassed):
    curl http://localhost:3003/health

Visit http://localhost:3003 for detailed information!
`);
