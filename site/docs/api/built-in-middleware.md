# Built-in Middleware

Verb includes a comprehensive set of built-in middleware for common web server functionality, optimized for Bun's performance.

## Importing Middleware

```typescript
import { 
  cors, 
  compression, 
  rateLimit, 
  staticFiles, 
  session, 
  json, 
  urlencoded,
  helmet,
  morgan,
  timeout
} from "verb/middleware";
```

## JSON & Body Parsing

### json()

Parse JSON request bodies:

```typescript
app.use(json({
  limit: "10mb",           // Request size limit
  strict: true,            // Only parse objects and arrays
  type: "application/json", // Content-Type to parse
  verify: (req, body) => { // Custom verification
    // Verify body integrity
  }
}));

app.post("/api/data", (req, res) => {
  console.log(req.body); // Parsed JSON object
  res.json({ received: true });
});
```

**Options:**
```typescript
interface JsonOptions {
  limit?: string | number;
  strict?: boolean;
  type?: string | string[] | ((req: VerbRequest) => boolean);
  verify?: (req: VerbRequest, body: Buffer) => void;
  reviver?: (key: string, value: any) => any;
}
```

### urlencoded()

Parse URL-encoded form data:

```typescript
app.use(urlencoded({
  extended: true,          // Use qs library for parsing
  limit: "10mb",           // Request size limit
  parameterLimit: 1000,    // Max number of parameters
  type: "application/x-www-form-urlencoded"
}));

app.post("/form", (req, res) => {
  console.log(req.body); // Parsed form data
  res.json({ received: true });
});
```

**Options:**
```typescript
interface UrlencodedOptions {
  extended?: boolean;
  limit?: string | number;
  parameterLimit?: number;
  type?: string | string[] | ((req: VerbRequest) => boolean);
  verify?: (req: VerbRequest, body: Buffer) => void;
}
```

### raw()

Parse raw request bodies as Buffer:

```typescript
app.use(raw({
  limit: "10mb",
  type: "application/octet-stream"
}));

app.post("/upload", (req, res) => {
  console.log(req.body); // Buffer
  res.json({ size: req.body.length });
});
```

### text()

Parse request bodies as text:

```typescript
app.use(text({
  limit: "10mb",
  type: "text/plain",
  defaultCharset: "utf-8"
}));

app.post("/text", (req, res) => {
  console.log(req.body); // String
  res.json({ length: req.body.length });
});
```

## CORS (Cross-Origin Resource Sharing)

Enable cross-origin requests:

```typescript
// Basic CORS
app.use(cors());

// Custom CORS configuration
app.use(cors({
  origin: ["https://example.com", "https://app.example.com"],
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  exposedHeaders: ["X-Total-Count"],
  credentials: true,
  maxAge: 86400 // 24 hours
}));

// Dynamic origin
app.use(cors({
  origin: (origin) => {
    return origin?.endsWith(".example.com") || false;
  }
}));
```

**Options:**
```typescript
interface CorsOptions {
  origin?: string | string[] | boolean | ((origin: string) => boolean);
  methods?: string | string[];
  allowedHeaders?: string | string[];
  exposedHeaders?: string | string[];
  credentials?: boolean;
  maxAge?: number;
  preflightContinue?: boolean;
  optionsSuccessStatus?: number;
}
```

## Compression

Compress response bodies:

```typescript
// Basic compression
app.use(compression());

// Custom compression
app.use(compression({
  threshold: 1024,          // Only compress if body >= 1KB
  level: 6,                 // Compression level (1-9)
  filter: (req, res) => {   // Custom filter
    return req.get("accept-encoding")?.includes("gzip") ?? false;
  }
}));
```

**Supported algorithms:**
- gzip
- deflate
- brotli (when available)

## Rate Limiting

Limit request rates per client:

```typescript
// Basic rate limiting
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,                  // Limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP"
}));

// Custom rate limiting
app.use(rateLimit({
  windowMs: 60 * 1000,      // 1 minute
  max: (req) => {           // Dynamic limit
    return req.user?.isPremium ? 1000 : 100;
  },
  keyGenerator: (req) => {  // Custom key generator
    return req.user?.id || req.ip;
  },
  skip: (req) => {          // Skip certain requests
    return req.path.startsWith("/health");
  },
  handler: (req, res) => {  // Custom handler
    res.status(429).json({
      error: "Rate limit exceeded",
      retryAfter: Math.ceil(windowMs / 1000)
    });
  }
}));
```

## Static File Serving

Serve static files:

```typescript
// Basic static files
app.use(staticFiles({ root: "./public" }));

// Advanced static file serving
app.use("/assets", staticFiles({
  root: "./public",
  index: ["index.html", "index.htm"],
  dotfiles: "ignore",        // ignore, allow, deny
  etag: true,
  extensions: ["html", "htm"],
  fallthrough: true,
  immutable: false,
  lastModified: true,
  maxAge: "1d",             // Cache for 1 day
  redirect: true,
  setHeaders: (res, path) => {
    if (path.endsWith(".js")) {
      res.header("Cache-Control", "public, max-age=31536000");
    }
  }
}));
```

## Session Management

Handle user sessions:

```typescript
app.use(session({
  secret: "your-secret-key",
  name: "sessionId",
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax"
  },
  resave: false,
  saveUninitialized: false,
  rolling: true
}));

app.get("/profile", (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  
  res.json({ user: req.session.user });
});

app.post("/login", (req, res) => {
  // Authenticate user
  req.session.user = { id: 1, email: "user@example.com" };
  res.json({ success: true });
});

app.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: "Could not log out" });
    }
    res.json({ success: true });
  });
});
```

## Security Headers (Helmet)

Set security-related HTTP headers:

```typescript
// Basic helmet
app.use(helmet());

// Custom helmet configuration
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  xssFilter: true,
  noSniff: true,
  frameguard: { action: "deny" },
  referrerPolicy: { policy: "same-origin" }
}));
```

**Security headers set:**
- Content-Security-Policy
- Strict-Transport-Security
- X-Content-Type-Options
- X-Frame-Options
- X-XSS-Protection
- Referrer-Policy

## Request Logging (Morgan)

Log HTTP requests:

```typescript
// Predefined formats
app.use(morgan("combined"));  // Apache combined format
app.use(morgan("common"));    // Apache common format
app.use(morgan("dev"));       // Colored output for development
app.use(morgan("short"));     // Shorter than default
app.use(morgan("tiny"));      // Minimal output

// Custom format
app.use(morgan(":method :url :status :res[content-length] - :response-time ms"));

// Custom function
app.use(morgan((tokens, req, res) => {
  return [
    tokens.method(req, res),
    tokens.url(req, res),
    tokens.status(req, res),
    tokens.res(req, res, "content-length"), "-",
    tokens["response-time"](req, res), "ms"
  ].join(" ");
}));

// Conditional logging
app.use(morgan("combined", {
  skip: (req, res) => res.statusCode < 400
}));
```

## Request Timeout

Set request timeout:

```typescript
// Basic timeout
app.use(timeout("30s"));

// Custom timeout with handler
app.use(timeout("5s", {
  respond: true,
  handler: (req, res) => {
    res.status(408).json({
      error: "Request Timeout",
      message: "The request took too long to process"
    });
  }
}));

// Route-specific timeout
app.get("/slow-operation", 
  timeout("60s"),
  async (req, res) => {
    const result = await longRunningOperation();
    res.json(result);
  }
);
```

## Cookie Parser

Parse request cookies:

```typescript
app.use(cookieParser("optional-secret"));

app.get("/", (req, res) => {
  console.log("Cookies:", req.cookies);
  console.log("Signed Cookies:", req.signedCookies);
  
  res.cookie("visited", "true", { maxAge: 900000 });
  res.json({ cookies: req.cookies });
});
```

## Multipart/Form-Data (Multer)

Handle file uploads:

```typescript
import { multer } from "verb/middleware";

// Basic file upload
const upload = multer({ dest: "uploads/" });

app.post("/upload", upload.single("file"), (req, res) => {
  console.log(req.file);    // File information
  console.log(req.body);    // Form fields
  res.json({ success: true });
});

// Multiple files
app.post("/uploads", upload.array("files", 5), (req, res) => {
  console.log(req.files);   // Array of files
  res.json({ count: req.files.length });
});

// Custom storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const uploadCustom = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only images allowed"));
    }
  }
});
```

## Custom Middleware Example

Creating your own middleware:

```typescript
// Request ID middleware
const requestId = () => {
  return (req: VerbRequest, res: VerbResponse, next: NextFunction) => {
    req.id = crypto.randomUUID();
    res.header("X-Request-ID", req.id);
    next();
  };
};

// Performance timing middleware
const timing = () => {
  return (req: VerbRequest, res: VerbResponse, next: NextFunction) => {
    const start = process.hrtime.bigint();
    
    res.on("finish", () => {
      const end = process.hrtime.bigint();
      const duration = Number(end - start) / 1000000; // Convert to ms
      
      res.header("X-Response-Time", `${duration.toFixed(2)}ms`);
      console.log(`${req.method} ${req.url} - ${duration.toFixed(2)}ms`);
    });
    
    next();
  };
};

// Usage
app.use(requestId());
app.use(timing());
```

## Middleware Composition

Combining multiple middleware:

```typescript
// Create a composed middleware stack
const apiMiddleware = [
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(","),
    credentials: true
  }),
  helmet({
    contentSecurityPolicy: false // Disable for API
  }),
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000
  }),
  json({ limit: "1mb" }),
  compression({ threshold: 1024 })
];

// Apply to all API routes
app.use("/api", ...apiMiddleware);

// Or apply to specific routes
app.get("/api/users", 
  ...apiMiddleware,
  (req, res) => {
    res.json({ users: [] });
  }
);
```

## Error Handling Middleware

Global error handler:

```typescript
const errorHandler = (
  err: Error, 
  req: VerbRequest, 
  res: VerbResponse, 
  next: NextFunction
) => {
  console.error("Error:", err);
  
  // Handle specific error types
  if (err.name === "ValidationError") {
    return res.status(400).json({
      error: "Validation Error",
      details: err.message
    });
  }
  
  if (err.name === "CastError") {
    return res.status(400).json({
      error: "Invalid ID format"
    });
  }
  
  // Default error response
  res.status(500).json({
    error: "Internal Server Error",
    message: process.env.NODE_ENV === "development" ? err.message : "Something went wrong"
  });
};

// Must be added after all other middleware and routes
app.use(errorHandler);
```

## Best Practices

1. **Order Matters**: Apply middleware in the correct order
2. **Performance**: Use appropriate limits and caching
3. **Security**: Always validate and sanitize input
4. **Error Handling**: Implement proper error boundaries
5. **Monitoring**: Log important events and metrics

## See Also

- [Middleware API](/api/middleware) - Creating custom middleware
- [Error Handling](/api/error-handling) - Error handling patterns
- [Security](/guide/security) - Security best practices
- [Performance](/guide/performance) - Performance optimization