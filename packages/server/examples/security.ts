import {
  createServer,
  json,
  securityHeaders,
  csrfProtection,
  generateCSRFToken,
  inputSanitization,
  defaultSecurity,
  InputSanitizer,
  type SecurityOptions
} from "../src/index.ts";

const app = createServer({ port: 3002 });

// Custom security configuration
const customSecurityOptions: SecurityOptions = {
  contentSecurityPolicy: {
    enabled: true,
    directives: {
      'default-src': ["'self'"],
      'script-src': ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      'style-src': ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      'font-src': ["'self'", "https://fonts.gstatic.com"],
      'img-src': ["'self'", "data:", "https:"],
      'connect-src': ["'self'", "https://api.example.com"]
    }
  },
  hsts: {
    enabled: true,
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: false
  },
  frameguard: 'deny',
  referrerPolicy: 'strict-origin-when-cross-origin'
};

// Apply security middleware with custom configuration
app.use(securityHeaders(customSecurityOptions));

// Apply input sanitization
app.use(inputSanitization({
  stripScripts: true,
  stripHtml: false, // Allow some HTML
  removeNullBytes: true,
  trim: true
}));

// Root endpoint with security information
app.get('/', () => {
  return json({
    message: 'Security Features Demo',
    securityFeatures: [
      'Security Headers (CSP, HSTS, X-Frame-Options, etc.)',
      'CSRF Protection',
      'Input Sanitization',
      'XSS Prevention'
    ],
    endpoints: {
      'GET /csrf-token': 'Get CSRF token for protected operations',
      'POST /protected': 'CSRF protected endpoint',
      'POST /sanitize': 'Input sanitization demo',
      'GET /headers': 'View security headers',
      'POST /xss-test': 'XSS prevention test'
    },
    testInstructions: {
      step1: 'GET /csrf-token to get a token',
      step2: 'Use token in POST /protected with x-csrf-token header',
      step3: 'Try POST /sanitize with malicious input',
      step4: 'Check response headers for security configuration'
    }
  });
});

// CSRF token endpoint
app.get('/csrf-token', (req) => {
  const sessionId = req.headers.get('x-session-id') || 'demo-session-' + Date.now();
  const token = generateCSRFToken(sessionId);
  
  return json({
    csrfToken: token,
    sessionId,
    usage: 'Include this token in x-csrf-token header or _csrf body field',
    exampleHeader: `x-csrf-token: ${token}`,
    exampleBody: `{"_csrf": "${token}", "data": "your data"}`
  });
});

// CSRF protected endpoint (manual protection within handler)
app.post('/protected', async (req) => {
  // Apply CSRF protection manually for this endpoint
  const csrfMiddleware = csrfProtection({
    tokenHeader: 'x-csrf-token',
    tokenBody: '_csrf'
  });
  
  try {
    await csrfMiddleware(req, async () => {
      return new Response(); // Dummy response for validation
    });
  } catch (error) {
    return json({ error: 'CSRF token validation failed' }, 403);
  }
  
  const body = await req.json();
  
  return json({
    message: 'CSRF protection passed!',
    received: body,
    timestamp: new Date().toISOString(),
    sessionId: req.headers.get('x-session-id') || 'demo-session'
  });
});

// Input sanitization demo
app.post('/sanitize', async (req) => {
  try {
    const body = await req.json();
    
    // Manual sanitization examples
    const examples = {
      original: body,
      sanitized: {
        basic: InputSanitizer.sanitizeObject(body, {
          stripScripts: true,
          removeNullBytes: true,
          trim: true
        }),
        aggressive: InputSanitizer.sanitizeObject(body, {
          stripHtml: true,
          stripScripts: true,
          removeNullBytes: true,
          trim: true,
          toLowerCase: false
        }),
        custom: InputSanitizer.sanitizeObject(body, {
          stripScripts: true,
          custom: (input) => input.replace(/[<>]/g, '')
        })
      }
    };

    return json({
      message: 'Input sanitization demo',
      examples,
      automaticSanitization: (req as any).sanitizedBody || 'No automatic sanitization applied',
      tips: [
        'stripScripts removes <script> tags and javascript: URLs',
        'stripHtml removes all HTML tags',
        'removeNullBytes removes null characters',
        'custom allows for custom sanitization functions'
      ]
    });
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
});

// Security headers inspection endpoint
app.get('/headers', (req) => {
  const requestHeaders: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    requestHeaders[key] = value;
  });

  return json({
    message: 'Security headers inspection',
    note: 'Check the response headers to see applied security policies',
    requestHeaders,
    expectedSecurityHeaders: [
      'Content-Security-Policy',
      'Strict-Transport-Security',
      'X-Frame-Options',
      'X-Content-Type-Options',
      'Referrer-Policy',
      'X-XSS-Protection',
      'Cross-Origin-Embedder-Policy',
      'Cross-Origin-Opener-Policy'
    ]
  });
});

// XSS prevention test
app.post('/xss-test', async (req) => {
  try {
    const body = await req.json();
    const { payload } = body;

    if (!payload) {
      return json({ error: 'Missing payload field' }, 400);
    }

    // Show different levels of XSS protection
    const xssTests = {
      original: payload,
      sanitized: InputSanitizer.sanitize(payload, {
        stripScripts: true,
        stripHtml: false
      }),
      fullyStripped: InputSanitizer.sanitize(payload, {
        stripScripts: true,
        stripHtml: true
      }),
      escaped: payload.replace(/[&<>"']/g, (match) => {
        const escapeMap: Record<string, string> = {
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#x27;'
        };
        return escapeMap[match];
      })
    };

    return json({
      message: 'XSS prevention test results',
      testPayload: payload,
      results: xssTests,
      recommendations: [
        'Use stripScripts to remove script tags',
        'Use stripHtml to remove all HTML if not needed',
        'Use HTML escaping for display in HTML context',
        'Validate input against expected patterns',
        'Use Content Security Policy headers'
      ]
    });
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
});

// Endpoint demonstrating default security middleware
app.get('/default-security', async (req) => {
  // Apply default security middleware manually
  const securityMiddleware = defaultSecurity();
  
  const response = await securityMiddleware(req, async () => {
    return json({
      message: 'This endpoint uses default security middleware',
      applied: [
        'Security headers with safe defaults',
        'Input sanitization (scripts, null bytes)',
        'Automatic XSS protection'
      ]
    });
  });
  
  return response;
});

// Vulnerability demonstration (for educational purposes)
app.post('/vulnerable', async (req) => {
  try {
    const body = await req.json();
    
    return json({
      warning: '⚠️  This endpoint deliberately shows vulnerabilities',
      received: body,
      note: 'In production, this data would be sanitized automatically',
      vulnerabilities: {
        xss: 'Unsanitized user input could contain scripts',
        injection: 'No input validation or sanitization',
        headers: 'Missing security headers (but Verb adds them automatically)'
      },
      mitigation: 'Use input sanitization and validation middleware'
    });
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
});

console.log(`
🔒 Security Features Demo Server Started!

Test the security features:

1. Get CSRF Token:
   curl http://localhost:3002/csrf-token

2. Test CSRF Protection (will fail without token):
   curl -X POST http://localhost:3002/protected \\
     -H "Content-Type: application/json" \\
     -d '{"data":"test"}'

3. Test CSRF Protection (with token):
   TOKEN=$(curl -s http://localhost:3002/csrf-token | jq -r .csrfToken)
   curl -X POST http://localhost:3002/protected \\
     -H "Content-Type: application/json" \\
     -H "x-csrf-token: $TOKEN" \\
     -d '{"data":"test"}'

4. Test Input Sanitization:
   curl -X POST http://localhost:3002/sanitize \\
     -H "Content-Type: application/json" \\
     -d '{"name":"<script>alert(\"xss\")</script>John","bio":"Safe content"}'

5. Test XSS Prevention:
   curl -X POST http://localhost:3002/xss-test \\
     -H "Content-Type: application/json" \\
     -d '{"payload":"<script>alert(\"XSS\")</script><img src=x onerror=alert(1)>"}'

6. Check Security Headers:
   curl -I http://localhost:3002/headers

7. Test Default Security:
   curl http://localhost:3002/default-security

Visit http://localhost:3002 for interactive examples!
`);
