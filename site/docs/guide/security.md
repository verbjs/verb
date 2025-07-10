# Security

Verb provides comprehensive security features to protect your applications from common threats and vulnerabilities.

## Overview

Security features include:
- **Authentication & Authorization**: JWT, OAuth, custom auth
- **Input Validation**: Request validation and sanitization
- **Rate Limiting**: Prevent abuse and DoS attacks
- **CORS**: Cross-origin resource sharing control
- **Security Headers**: Helmet-style security headers
- **Encryption**: Data encryption and secure communication

## Authentication

### JWT Authentication

```typescript
import { createServer, middleware } from "verb";
import jwt from "jsonwebtoken";

const app = createServer();
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

// Login endpoint
app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;
  
  // Validate credentials
  const user = await validateUser(email, password);
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  
  // Generate JWT token
  const token = jwt.sign(
    { 
      userId: user.id, 
      email: user.email,
      role: user.role
    },
    JWT_SECRET,
    { 
      expiresIn: "24h",
      issuer: "your-app",
      audience: "your-app-users"
    }
  );
  
  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role
    }
  });
});

// JWT middleware
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.get("authorization");
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid token" });
    }
    
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Fetch current user data
    const user = await getUserById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }
    
    req.user = user;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expired" });
    } else if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ error: "Invalid token" });
    }
    
    return res.status(500).json({ error: "Authentication error" });
  }
};

// Protected route
app.get("/api/profile", authenticate, (req, res) => {
  res.json({ user: req.user });
});
```

### Role-Based Access Control

```typescript
const authorize = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    
    next();
  };
};

// Admin only route
app.get("/api/admin/users", 
  authenticate, 
  authorize(["admin"]), 
  (req, res) => {
    res.json({ users: getAllUsers() });
  }
);

// Multiple role access
app.get("/api/content", 
  authenticate, 
  authorize(["admin", "editor", "user"]), 
  (req, res) => {
    res.json({ content: getContent() });
  }
);
```

### OAuth Integration

```typescript
// OAuth with Google
app.get("/auth/google", (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: "openid email profile",
    state: generateState()
  });
  
  res.redirect(`https://accounts.google.com/oauth/authorize?${params}`);
});

app.get("/auth/google/callback", async (req, res) => {
  const { code, state } = req.query;
  
  try {
    // Verify state parameter
    if (!verifyState(state)) {
      return res.status(400).json({ error: "Invalid state parameter" });
    }
    
    // Exchange code for token
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
        redirect_uri: process.env.GOOGLE_REDIRECT_URI
      })
    });
    
    const tokens = await tokenResponse.json();
    
    // Get user info
    const userResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });
    
    const googleUser = await userResponse.json();
    
    // Create or update user
    const user = await findOrCreateUser({
      googleId: googleUser.id,
      email: googleUser.email,
      name: googleUser.name,
      picture: googleUser.picture
    });
    
    // Generate JWT
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "24h" });
    
    res.redirect(`/auth/success?token=${token}`);
  } catch (error) {
    console.error("OAuth error:", error);
    res.redirect("/auth/error");
  }
});
```

## Input Validation

### Request Validation

```typescript
import { z } from "zod";

// Validation schemas
const userSchema = z.object({
  name: z.string().min(2).max(50),
  email: z.string().email(),
  age: z.number().int().min(18).max(120),
  role: z.enum(["user", "admin", "editor"])
});

const validateBody = (schema) => {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: "Validation error",
          details: error.errors.map(err => ({
            field: err.path.join("."),
            message: err.message
          }))
        });
      }
      next(error);
    }
  };
};

app.post("/api/users", validateBody(userSchema), (req, res) => {
  // req.body is now validated and typed
  const user = createUser(req.body);
  res.status(201).json(user);
});
```

### SQL Injection Prevention

```typescript
// Using parameterized queries with bun:sqlite
import { Database } from "bun:sqlite";

const db = new Database("app.db");

// WRONG - vulnerable to SQL injection
const getUserBad = (email) => {
  const query = `SELECT * FROM users WHERE email = '${email}'`;
  return db.query(query).get();
};

// CORRECT - using parameterized queries
const getUser = (email) => {
  const query = db.query("SELECT * FROM users WHERE email = ?");
  return query.get(email);
};

// Using prepared statements for better performance
const getUserStmt = db.prepare("SELECT * FROM users WHERE email = ?");
const getUser = (email) => getUserStmt.get(email);
```

### XSS Prevention

```typescript
// Input sanitization
import DOMPurify from "isomorphic-dompurify";

const sanitizeInput = (input) => {
  if (typeof input !== "string") return input;
  
  // Basic HTML encoding
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
};

// For HTML content that needs to allow some tags
const sanitizeHTML = (html) => {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["b", "i", "em", "strong", "p", "br"],
    ALLOWED_ATTR: []
  });
};

app.post("/api/comments", (req, res) => {
  const { content } = req.body;
  
  const comment = {
    id: generateId(),
    content: sanitizeHTML(content),
    createdAt: new Date().toISOString()
  };
  
  saveComment(comment);
  res.status(201).json(comment);
});
```

## Rate Limiting

### Basic Rate Limiting

```typescript
const rateLimitStore = new Map();

const rateLimit = (options = {}) => {
  const windowMs = options.windowMs || 15 * 60 * 1000; // 15 minutes
  const max = options.max || 100; // 100 requests per window
  const message = options.message || "Too many requests";
  
  return (req, res, next) => {
    const key = req.ip || req.headers.get("x-forwarded-for") || "unknown";
    const now = Date.now();
    
    // Clean up old entries
    for (const [k, data] of rateLimitStore) {
      if (now - data.windowStart > windowMs) {
        rateLimitStore.delete(k);
      }
    }
    
    const userRequests = rateLimitStore.get(key) || {
      count: 0,
      windowStart: now
    };
    
    // Reset window if expired
    if (now - userRequests.windowStart > windowMs) {
      userRequests.count = 0;
      userRequests.windowStart = now;
    }
    
    userRequests.count++;
    rateLimitStore.set(key, userRequests);
    
    // Check limit
    if (userRequests.count > max) {
      return res.status(429).json({ 
        error: message,
        retryAfter: Math.ceil((windowMs - (now - userRequests.windowStart)) / 1000)
      });
    }
    
    // Add rate limit headers
    res.header("X-RateLimit-Limit", max.toString());
    res.header("X-RateLimit-Remaining", Math.max(0, max - userRequests.count).toString());
    res.header("X-RateLimit-Reset", new Date(userRequests.windowStart + windowMs).toISOString());
    
    next();
  };
};

// Apply rate limiting
app.use("/api/", rateLimit({ max: 100, windowMs: 15 * 60 * 1000 }));
app.use("/api/auth/login", rateLimit({ max: 5, windowMs: 15 * 60 * 1000 }));
```

### Advanced Rate Limiting

```typescript
class AdvancedRateLimit {
  constructor() {
    this.store = new Map();
    this.rules = new Map();
  }
  
  addRule(pattern, options) {
    this.rules.set(pattern, options);
  }
  
  middleware() {
    return (req, res, next) => {
      const rule = this.findMatchingRule(req.path);
      if (!rule) return next();
      
      const key = this.generateKey(req, rule);
      const result = this.checkLimit(key, rule);
      
      if (!result.allowed) {
        return res.status(429).json({
          error: "Rate limit exceeded",
          retryAfter: result.retryAfter
        });
      }
      
      // Add headers
      res.header("X-RateLimit-Limit", rule.max.toString());
      res.header("X-RateLimit-Remaining", result.remaining.toString());
      
      next();
    };
  }
  
  findMatchingRule(path) {
    for (const [pattern, rule] of this.rules) {
      if (new RegExp(pattern).test(path)) {
        return rule;
      }
    }
    return null;
  }
  
  generateKey(req, rule) {
    switch (rule.keyGenerator) {
      case "ip":
        return req.ip;
      case "user":
        return req.user?.id || req.ip;
      case "api-key":
        return req.headers.get("x-api-key") || req.ip;
      default:
        return req.ip;
    }
  }
  
  checkLimit(key, rule) {
    const now = Date.now();
    const userData = this.store.get(key) || { count: 0, windowStart: now };
    
    // Reset window if expired
    if (now - userData.windowStart > rule.windowMs) {
      userData.count = 0;
      userData.windowStart = now;
    }
    
    userData.count++;
    this.store.set(key, userData);
    
    const allowed = userData.count <= rule.max;
    const remaining = Math.max(0, rule.max - userData.count);
    const retryAfter = Math.ceil((rule.windowMs - (now - userData.windowStart)) / 1000);
    
    return { allowed, remaining, retryAfter };
  }
}

const rateLimiter = new AdvancedRateLimit();

// Different rules for different endpoints
rateLimiter.addRule("^/api/auth/", { 
  max: 5, 
  windowMs: 15 * 60 * 1000, 
  keyGenerator: "ip" 
});

rateLimiter.addRule("^/api/upload", { 
  max: 10, 
  windowMs: 60 * 60 * 1000, 
  keyGenerator: "user" 
});

app.use(rateLimiter.middleware());
```

## CORS Security

```typescript
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      "https://yourapp.com",
      "https://www.yourapp.com",
      "https://admin.yourapp.com"
    ];
    
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  maxAge: 86400, // 24 hours
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "X-API-Key"
  ],
  exposedHeaders: [
    "X-RateLimit-Limit",
    "X-RateLimit-Remaining"
  ]
};

app.use(middleware.cors(corsOptions));
```

## Security Headers

```typescript
const securityHeaders = (req, res, next) => {
  // Prevent clickjacking
  res.header("X-Frame-Options", "DENY");
  
  // Prevent MIME type sniffing
  res.header("X-Content-Type-Options", "nosniff");
  
  // XSS protection
  res.header("X-XSS-Protection", "1; mode=block");
  
  // HTTPS enforcement
  res.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  
  // Content Security Policy
  res.header("Content-Security-Policy", [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://apis.google.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    "connect-src 'self' https://api.yourapp.com"
  ].join("; "));
  
  // Referrer Policy
  res.header("Referrer-Policy", "strict-origin-when-cross-origin");
  
  // Permissions Policy
  res.header("Permissions-Policy", [
    "geolocation=()",
    "microphone=()",
    "camera=()"
  ].join(", "));
  
  next();
};

app.use(securityHeaders);
```

## Encryption

### Password Hashing

```typescript
import bcrypt from "bcryptjs";

const hashPassword = async (password) => {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
};

const verifyPassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};

app.post("/auth/register", async (req, res) => {
  const { email, password } = req.body;
  
  // Validate password strength
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }
  
  if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/.test(password)) {
    return res.status(400).json({ 
      error: "Password must contain uppercase, lowercase, number, and special character" 
    });
  }
  
  try {
    const hashedPassword = await hashPassword(password);
    const user = await createUser({ email, password: hashedPassword });
    
    res.status(201).json({ 
      success: true, 
      user: { id: user.id, email: user.email } 
    });
  } catch (error) {
    res.status(500).json({ error: "Registration failed" });
  }
});
```

### Data Encryption

```typescript
import crypto from "crypto";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32);
const IV_LENGTH = 16;

const encrypt = (text) => {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipher("aes-256-cbc", ENCRYPTION_KEY);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return `${iv.toString("hex")}:${encrypted}`;
};

const decrypt = (text) => {
  const [ivHex, encryptedHex] = text.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const decipher = crypto.createDecipher("aes-256-cbc", ENCRYPTION_KEY);
  let decrypted = decipher.update(encryptedHex, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
};

// Encrypt sensitive data before storing
const storeSensitiveData = (data) => {
  return {
    ...data,
    ssn: encrypt(data.ssn),
    creditCard: encrypt(data.creditCard)
  };
};
```

## Security Monitoring

```typescript
const securityLogger = {
  logFailedLogin: (email, ip, userAgent) => {
    console.log(JSON.stringify({
      event: "failed_login",
      email,
      ip,
      userAgent,
      timestamp: new Date().toISOString()
    }));
  },
  
  logSuspiciousActivity: (type, details, req) => {
    console.log(JSON.stringify({
      event: "suspicious_activity",
      type,
      details,
      ip: req.ip,
      userAgent: req.headers.get("user-agent"),
      timestamp: new Date().toISOString()
    }));
  },
  
  logSecurityViolation: (violation, req) => {
    console.log(JSON.stringify({
      event: "security_violation",
      violation,
      url: req.url,
      method: req.method,
      ip: req.ip,
      headers: Object.fromEntries(req.headers.entries()),
      timestamp: new Date().toISOString()
    }));
  }
};

// Security monitoring middleware
const securityMonitor = (req, res, next) => {
  // Check for suspicious patterns
  const suspiciousPatterns = [
    /(<script|javascript:|data:text\/html)/i,
    /(union.*select|drop.*table|insert.*into)/i,
    /(\.\.\/|\.\.\\|%2e%2e%2f)/i
  ];
  
  const checkString = `${req.url} ${JSON.stringify(req.body)}`;
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(checkString)) {
      securityLogger.logSecurityViolation("suspicious_pattern", req);
      return res.status(400).json({ error: "Request blocked" });
    }
  }
  
  next();
};

app.use(securityMonitor);
```

## Best Practices

1. **Use HTTPS**: Always use TLS/SSL in production
2. **Validate Everything**: Never trust user input
3. **Implement Rate Limiting**: Prevent abuse and DoS
4. **Use Strong Authentication**: Implement proper auth flows
5. **Keep Dependencies Updated**: Regularly update packages
6. **Log Security Events**: Monitor for suspicious activity
7. **Use Security Headers**: Implement comprehensive security headers
8. **Encrypt Sensitive Data**: Protect data at rest and in transit
9. **Follow OWASP Guidelines**: Stay updated with security best practices
10. **Regular Security Audits**: Conduct penetration testing

## Security Checklist

- [ ] HTTPS enabled with strong TLS configuration
- [ ] Input validation on all endpoints
- [ ] SQL injection protection with parameterized queries
- [ ] XSS prevention with input sanitization
- [ ] CSRF protection implemented
- [ ] Rate limiting configured
- [ ] Strong authentication system
- [ ] Authorization checks on protected resources
- [ ] Security headers configured
- [ ] Password hashing with salt
- [ ] Sensitive data encryption
- [ ] Security logging and monitoring
- [ ] Regular dependency updates
- [ ] Error handling that doesn't leak information

## Next Steps

- [Performance](/guide/performance) - Optimization techniques
- [Testing](/guide/testing) - Security testing strategies
- [Monitoring](/guide/monitoring) - Security monitoring