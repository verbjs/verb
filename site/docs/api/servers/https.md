# HTTPS Server

API reference for creating secure HTTPS servers with TLS/SSL certificates, security configurations, and best practices.

## Creating HTTPS Server

### Basic HTTPS Server

```typescript
import { createServer, ServerProtocol } from "verb";

const app = createServer(ServerProtocol.HTTPS);

app.withOptions({
  port: 443,
  tls: {
    cert: await Bun.file("./certs/server.crt").text(),
    key: await Bun.file("./certs/server.key").text()
  }
});

app.get("/", (req, res) => {
  res.json({ 
    message: "Secure HTTPS connection!",
    secure: req.secure 
  });
});

app.listen(443);
console.log("HTTPS server running on https://localhost:443");
```

### Certificate Loading

```typescript
// Load certificates from files
const app = createServer(ServerProtocol.HTTPS);

app.withOptions({
  port: 443,
  tls: {
    cert: await Bun.file("./ssl/certificate.pem").text(),
    key: await Bun.file("./ssl/private-key.pem").text(),
    ca: await Bun.file("./ssl/ca-certificate.pem").text() // Optional CA chain
  }
});

// Or load from environment variables
app.withOptions({
  port: 443,
  tls: {
    cert: process.env.SSL_CERT,
    key: process.env.SSL_KEY,
    passphrase: process.env.SSL_PASSPHRASE // If key is encrypted
  }
});
```

## TLS Configuration

### Advanced TLS Options

```typescript
app.withOptions({
  port: 443,
  tls: {
    cert: certificateContent,
    key: privateKeyContent,
    ca: caCertificateContent,
    
    // Security options
    ciphers: [
      "ECDHE-RSA-AES128-GCM-SHA256",
      "ECDHE-RSA-AES256-GCM-SHA384",
      "ECDHE-RSA-AES128-SHA256",
      "ECDHE-RSA-AES256-SHA384"
    ].join(":"),
    
    secureProtocol: "TLSv1_2_method", // Force TLS 1.2+
    honorCipherOrder: true,
    
    // Client certificate verification
    requestCert: false,
    rejectUnauthorized: true,
    
    // Session management
    sessionTimeout: 300, // 5 minutes
    sessionIdContext: "verb-server"
  }
});
```

### Multiple Certificates (SNI)

Server Name Indication for multiple domains:

```typescript
app.withOptions({
  port: 443,
  tls: {
    // Default certificate
    cert: defaultCert,
    key: defaultKey,
    
    // SNI configuration
    SNICallback: (servername, callback) => {
      if (servername === "api.example.com") {
        callback(null, {
          cert: apiCert,
          key: apiKey
        });
      } else if (servername === "app.example.com") {
        callback(null, {
          cert: appCert,
          key: appKey
        });
      } else {
        callback(null, {
          cert: defaultCert,
          key: defaultKey
        });
      }
    }
  }
});
```

## Certificate Management

### Self-Signed Certificates (Development)

```typescript
import { generateCertificate } from "verb/tls";

// Generate self-signed certificate for development
const { cert, key } = await generateCertificate({
  subject: {
    commonName: "localhost",
    organization: "Development",
    organizationalUnit: "IT Department",
    locality: "San Francisco",
    state: "CA",
    country: "US"
  },
  issuer: {
    commonName: "Development CA"
  },
  extensions: {
    subjectAltName: [
      "DNS:localhost",
      "DNS:*.localhost",
      "IP:127.0.0.1",
      "IP:::1"
    ]
  },
  validityDays: 365
});

app.withOptions({
  port: 443,
  tls: { cert, key }
});
```

### Let's Encrypt Integration

```typescript
import { getLetsEncryptCert } from "verb/letsencrypt";

// Automatic Let's Encrypt certificate
const { cert, key } = await getLetsEncryptCert({
  domains: ["example.com", "www.example.com"],
  email: "admin@example.com",
  staging: false, // Set to true for testing
  challengeType: "http-01",
  renewalDays: 30 // Auto-renew 30 days before expiry
});

app.withOptions({
  port: 443,
  tls: { cert, key }
});
```

### Certificate Renewal

```typescript
import { CertificateManager } from "verb/tls";

const certManager = new CertificateManager({
  provider: "letsencrypt",
  email: "admin@example.com",
  domains: ["example.com"],
  autoRenew: true,
  renewalDays: 30,
  storage: "./ssl-certs" // Certificate storage directory
});

// Initialize certificate manager
await certManager.initialize();

// Get current certificates
const { cert, key } = await certManager.getCertificates();

app.withOptions({
  port: 443,
  tls: { cert, key }
});

// Auto-renewal (runs in background)
certManager.startAutoRenewal();
```

## Security Headers

### HTTPS Security Middleware

```typescript
import { httpsOnly, hsts, secureHeaders } from "verb/middleware";

// Force HTTPS for all requests
app.use(httpsOnly({
  trustProxyHeader: true, // Trust X-Forwarded-Proto header
  includeSubDomains: true
}));

// HTTP Strict Transport Security
app.use(hsts({
  maxAge: 31536000, // 1 year
  includeSubDomains: true,
  preload: true
}));

// Security headers
app.use(secureHeaders({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"]
    }
  },
  referrerPolicy: "strict-origin-when-cross-origin"
}));
```

### Manual Security Headers

```typescript
app.use((req, res, next) => {
  // Strict Transport Security
  res.header("Strict-Transport-Security", 
    "max-age=31536000; includeSubDomains; preload");
  
  // Content Security Policy
  res.header("Content-Security-Policy", 
    "default-src 'self'; script-src 'self'");
  
  // Other security headers
  res.header("X-Content-Type-Options", "nosniff");
  res.header("X-Frame-Options", "DENY");
  res.header("X-XSS-Protection", "1; mode=block");
  res.header("Referrer-Policy", "strict-origin-when-cross-origin");
  
  next();
});
```

## Client Certificate Authentication

### Mutual TLS (mTLS)

```typescript
app.withOptions({
  port: 443,
  tls: {
    cert: serverCert,
    key: serverKey,
    ca: clientCaCert, // CA that signed client certificates
    
    // Require client certificates
    requestCert: true,
    rejectUnauthorized: true
  }
});

// Middleware to handle client certificates
app.use((req, res, next) => {
  const clientCert = req.socket.getPeerCertificate();
  
  if (!clientCert || !clientCert.subject) {
    return res.status(401).json({ error: "Client certificate required" });
  }
  
  // Verify client certificate
  req.clientCert = {
    subject: clientCert.subject,
    issuer: clientCert.issuer,
    valid: clientCert.valid_from && clientCert.valid_to,
    fingerprint: clientCert.fingerprint
  };
  
  next();
});

app.get("/secure", (req, res) => {
  res.json({
    message: "Secure endpoint accessed",
    client: req.clientCert.subject.CN,
    certificate: req.clientCert
  });
});
```

## HTTP to HTTPS Redirection

### Automatic Redirection

```typescript
import { createServer, ServerProtocol } from "verb";

// Create HTTP server for redirection
const httpApp = createServer(ServerProtocol.HTTP);

httpApp.use((req, res) => {
  const httpsUrl = `https://${req.hostname}${req.url}`;
  res.redirect(301, httpsUrl);
});

httpApp.listen(80);

// Main HTTPS server
const httpsApp = createServer(ServerProtocol.HTTPS);

httpsApp.withOptions({
  port: 443,
  tls: { cert, key }
});

httpsApp.get("/", (req, res) => {
  res.json({ message: "Secure HTTPS connection" });
});

httpsApp.listen(443);
```

### Combined HTTP/HTTPS Server

```typescript
const app = createServer();

app.withOptions({
  // HTTP configuration
  http: {
    port: 80,
    redirectToHttps: true
  },
  
  // HTTPS configuration
  https: {
    port: 443,
    tls: { cert, key }
  }
});

app.get("/", (req, res) => {
  res.json({
    secure: req.secure,
    protocol: req.protocol
  });
});

// Starts both HTTP and HTTPS servers
app.listen();
```

## Performance Optimization

### TLS Session Resumption

```typescript
app.withOptions({
  port: 443,
  tls: {
    cert, key,
    
    // Session resumption
    sessionTimeout: 300,
    sessionIdContext: "verb-https-server",
    
    // Session tickets
    sessionTicketKeys: [
      generateSessionTicketKey(),
      generateSessionTicketKey() // For key rotation
    ]
  }
});
```

### HTTP/2 Over HTTPS

```typescript
const app = createServer(ServerProtocol.HTTPS);

app.withOptions({
  port: 443,
  tls: { cert, key },
  
  // Enable HTTP/2
  http2: {
    allowHTTP1: true, // Fallback to HTTP/1.1
    maxSessionMemory: 10,
    settings: {
      headerTableSize: 4096,
      enablePush: false,
      maxConcurrentStreams: 100,
      initialWindowSize: 65535
    }
  }
});
```

## Development vs Production

### Development Configuration

```typescript
const isDevelopment = process.env.NODE_ENV === "development";

if (isDevelopment) {
  // Self-signed certificate for development
  const { cert, key } = await generateSelfSignedCert();
  
  app.withOptions({
    port: 3443,
    tls: {
      cert, key,
      rejectUnauthorized: false // Accept self-signed certs
    },
    development: {
      hmr: true,
      console: true
    }
  });
} else {
  // Production configuration
  app.withOptions({
    port: 443,
    tls: {
      cert: process.env.SSL_CERT,
      key: process.env.SSL_KEY,
      ciphers: PRODUCTION_CIPHERS,
      secureProtocol: "TLSv1_2_method",
      honorCipherOrder: true
    }
  });
}
```

### Production Security Checklist

```typescript
// Production HTTPS security configuration
app.withOptions({
  port: 443,
  tls: {
    cert: productionCert,
    key: productionKey,
    
    // Strong security settings
    secureProtocol: "TLSv1_3_method", // TLS 1.3 only
    ciphers: [
      "TLS_AES_256_GCM_SHA384",
      "TLS_CHACHA20_POLY1305_SHA256",
      "TLS_AES_128_GCM_SHA256"
    ].join(":"),
    
    honorCipherOrder: true,
    rejectUnauthorized: true,
    
    // OCSP stapling
    enableOCSPStapling: true
  }
});

// Security middleware
app.use(helmet({
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  }
}));
```

## Monitoring and Logging

### TLS Event Logging

```typescript
app.withOptions({
  port: 443,
  tls: {
    cert, key,
    
    // TLS event handlers
    onSecureConnection: (tlsSocket) => {
      console.log("Secure connection established:", {
        cipher: tlsSocket.getCipher(),
        protocol: tlsSocket.getProtocol(),
        authorized: tlsSocket.authorized,
        peerCertificate: tlsSocket.getPeerCertificate()
      });
    },
    
    onClientError: (error, tlsSocket) => {
      console.error("TLS client error:", error.message);
    }
  }
});
```

### Certificate Monitoring

```typescript
import { CertificateMonitor } from "verb/monitoring";

const monitor = new CertificateMonitor({
  certificates: [
    { path: "./ssl/cert.pem", name: "main" },
    { path: "./ssl/api-cert.pem", name: "api" }
  ],
  checkInterval: 24 * 60 * 60 * 1000, // Check daily
  expiryWarningDays: 30
});

monitor.on("expiring", (cert, daysLeft) => {
  console.warn(`Certificate ${cert.name} expires in ${daysLeft} days`);
  // Send alert notification
});

monitor.on("expired", (cert) => {
  console.error(`Certificate ${cert.name} has expired!`);
  // Send critical alert
});

monitor.start();
```

## Testing HTTPS Server

```typescript
import { test, expect } from "bun:test";
import request from "supertest";

// Skip certificate verification for testing
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

test("HTTPS server responds correctly", async () => {
  const response = await request(httpsApp)
    .get("/")
    .expect(200);
    
  expect(response.body.secure).toBe(true);
});

test("HTTP redirects to HTTPS", async () => {
  const response = await request(httpApp)
    .get("/test")
    .expect(301);
    
  expect(response.headers.location).toMatch(/^https:/);
});

test("security headers are present", async () => {
  const response = await request(httpsApp)
    .get("/")
    .expect(200);
    
  expect(response.headers["strict-transport-security"]).toBeDefined();
  expect(response.headers["x-content-type-options"]).toBe("nosniff");
});
```

## Troubleshooting

### Common SSL/TLS Issues

```typescript
// Certificate verification debugging
app.withOptions({
  tls: {
    cert, key,
    
    // Debug certificate issues
    checkServerIdentity: (hostname, cert) => {
      console.log("Checking server identity:", hostname, cert.subject);
      // Return undefined to use default verification
      return undefined;
    },
    
    // Custom verification callback
    verify: (ok, ctx) => {
      if (!ok) {
        console.error("Certificate verification failed:", ctx.error);
      }
      return ok;
    }
  }
});
```

### Error Handling

```typescript
app.on("tlsClientError", (err, tlsSocket) => {
  console.error("TLS client error:", {
    error: err.message,
    code: err.code,
    address: tlsSocket.remoteAddress
  });
});

app.on("secureConnection", (tlsSocket) => {
  console.log("Secure connection from:", tlsSocket.remoteAddress);
});
```

## Best Practices

1. **Use Strong TLS Versions**: TLS 1.2 minimum, prefer TLS 1.3
2. **Certificate Management**: Implement automatic renewal
3. **Security Headers**: Use HSTS and other security headers
4. **Regular Updates**: Keep certificates and ciphers updated
5. **Monitoring**: Monitor certificate expiry and TLS errors
6. **Testing**: Test SSL configuration regularly
7. **Performance**: Enable session resumption and OCSP stapling

## See Also

- [HTTP Server](/api/servers/http) - Basic HTTP server setup
- [HTTP/2 Server](/api/servers/http2) - HTTP/2 over HTTPS
- [Security Guide](/guide/security) - Security best practices
- [Certificate Management](/guide/certificates) - Managing SSL certificates