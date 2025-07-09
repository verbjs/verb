import { createServer, middleware } from '../../src/index';
import type { VerbRequest, VerbResponse } from '../../src/index';

const app = createServer();

// Example 1: Basic security setup with presets
console.log('🔒 Security Features Example');
console.log('============================');

// Development preset - more permissive for development
if (process.env.NODE_ENV === 'development') {
  const devSecurity = middleware.securityPresets.development();
  devSecurity.forEach(mw => app.use(mw));
  console.log('✅ Applied development security preset');
}

// Production preset - strict security
else if (process.env.NODE_ENV === 'production') {
  const prodSecurity = middleware.securityPresets.production();
  prodSecurity.forEach(mw => app.use(mw));
  console.log('✅ Applied production security preset');
}

// API preset - optimized for API usage
else {
  const apiSecurity = middleware.securityPresets.api();
  apiSecurity.forEach(mw => app.use(mw));
  console.log('✅ Applied API security preset');
}

// Example 2: Custom security configuration
const customSecurity = middleware.createSecurityMiddleware({
  // Trust proxy configuration
  trustProxy: {
    enabled: true,
    trustedProxies: ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16']
  },
  
  // Rate limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: VerbRequest) => {
      // Use API key if available, otherwise IP
      return req.headers.get('x-api-key') || req.ip || 'unknown';
    }
  },
  
  // CORS configuration
  cors: {
    origin: ['https://example.com', 'https://app.example.com'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
    credentials: true,
    maxAge: 86400 // 24 hours
  },
  
  // Security headers
  securityHeaders: {
    contentSecurityPolicy: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true
    },
    frameguard: { action: 'deny' },
    referrerPolicy: 'strict-origin-when-cross-origin'
  }
});

// Apply custom security to /api routes
app.use('/api', ...customSecurity);

// Example 3: Individual middleware usage
app.use('/admin', middleware.rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // Only 10 requests per 5 minutes for admin
  message: 'Admin area rate limited. Please try again later.'
}));

// Example 4: Custom rate limiting with different strategies
app.use('/upload', middleware.rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 uploads per minute
  keyGenerator: (req: VerbRequest) => {
    // Rate limit by user ID if authenticated, otherwise by IP
    const userId = req.headers.get('x-user-id');
    return userId || req.ip || 'unknown';
  },
  skipFailedRequests: true, // Don't count failed uploads
  onLimitReached: (req: VerbRequest, res: VerbResponse) => {
    console.log(`Rate limit exceeded for ${req.ip} at ${new Date().toISOString()}`);
  }
}));

// Example 5: Conditional CORS
app.use('/public-api', middleware.cors({
  origin: (origin: string) => {
    // Allow requests from any subdomain of example.com
    return origin.endsWith('.example.com') || origin === 'https://example.com';
  },
  credentials: false // Public API doesn't need credentials
}));

// Routes to demonstrate security features
app.get('/', (req: VerbRequest, res: VerbResponse) => {
  res.json({
    message: 'Security Example API',
    timestamp: new Date().toISOString(),
    headers: {
      'x-forwarded-proto': req.headers.get('x-forwarded-proto'),
      'x-forwarded-host': req.headers.get('x-forwarded-host'),
      'x-forwarded-for': req.headers.get('x-forwarded-for'),
      'origin': req.headers.get('origin'),
      'user-agent': req.headers.get('user-agent')
    },
    request: {
      ip: req.ip,
      protocol: req.protocol,
      secure: req.secure,
      hostname: req.hostname,
      path: req.path,
      method: req.method
    }
  });
});

app.get('/api/data', (req: VerbRequest, res: VerbResponse) => {
  res.json({
    message: 'Protected API endpoint',
    data: [1, 2, 3, 4, 5],
    rateLimitHeaders: {
      limit: res.getHeader('RateLimit-Limit'),
      remaining: res.getHeader('RateLimit-Remaining'),
      reset: res.getHeader('RateLimit-Reset')
    }
  });
});

app.post('/api/upload', (req: VerbRequest, res: VerbResponse) => {
  res.json({
    message: 'File upload endpoint (rate limited)',
    timestamp: new Date().toISOString(),
    rateLimitHeaders: {
      limit: res.getHeader('RateLimit-Limit'),
      remaining: res.getHeader('RateLimit-Remaining'),
      reset: res.getHeader('RateLimit-Reset')
    }
  });
});

app.get('/admin/users', (req: VerbRequest, res: VerbResponse) => {
  res.json({
    message: 'Admin endpoint (heavily rate limited)',
    users: ['admin', 'user1', 'user2'],
    rateLimitHeaders: {
      limit: res.getHeader('RateLimit-Limit'),
      remaining: res.getHeader('RateLimit-Remaining'),
      reset: res.getHeader('RateLimit-Reset')
    }
  });
});

app.get('/public-api/info', (req: VerbRequest, res: VerbResponse) => {
  res.json({
    message: 'Public API with conditional CORS',
    info: 'This endpoint allows cross-origin requests from *.example.com',
    timestamp: new Date().toISOString()
  });
});

// Error handling
app.use((err: Error, req: VerbRequest, res: VerbResponse, next: any) => {
  console.error('Error:', err.message);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

const port = 3000;
app.withOptions({
  port,
  hostname: 'localhost',
  development: {
    hmr: true,
    console: true
  }
});

app.listen();

console.log(`🚀 Security example server running on http://localhost:${port}`);
console.log('\\nEndpoints:');
console.log('  GET  /                    - Basic info with security headers');
console.log('  GET  /api/data           - Protected API endpoint');
console.log('  POST /api/upload         - Rate limited upload endpoint');
console.log('  GET  /admin/users        - Heavily rate limited admin endpoint');
console.log('  GET  /public-api/info    - Public API with conditional CORS');
console.log('\\nTesting suggestions:');
console.log('1. Try making multiple requests to /api/data to see rate limiting');
console.log('2. Check response headers for security headers');
console.log('3. Test CORS with different Origin headers');
console.log('4. Try accessing /admin/users rapidly to trigger rate limiting');
console.log('5. Send requests with X-Forwarded-* headers to test proxy trust');
console.log('\\nExample curl commands:');
console.log('curl -H "Origin: https://example.com" http://localhost:3000/public-api/info');
console.log('curl -H "X-API-Key: test-key" http://localhost:3000/api/data');
console.log('curl -H "X-Forwarded-Proto: https" -H "X-Forwarded-Host: example.com" http://localhost:3000/');