/**
 * HTTP/2 Server Example with Verb
 * 
 * This example demonstrates how to create an HTTP/2 server with TLS
 * and utilize HTTP/2 specific features like server push.
 */

import { 
  createServer, 
  html, 
  text, 
  responseWithPush,
  http2Middleware,
  StreamPriority,
  createHttp2Headers 
} from "../src/index.ts";

// First, generate a self-signed certificate for development:
// openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/CN=localhost"

const app = createServer({
  port: 3443,
  http2: true,
  development: true, // Allow self-signed certificates in development
  tls: {
    cert: "./cert.pem",  // Path to your certificate
    key: "./key.pem"     // Path to your private key
  }
});

// Add HTTP/2 optimization middleware
app.use(http2Middleware);

// Home page with server push
app.get("/", () => {
  const criticalResources = [
    { path: "/styles/critical.css", type: "text/css", importance: "high" as const },
    { path: "/js/app.js", type: "application/javascript", importance: "medium" as const },
    { path: "/fonts/main.woff2", type: "font/woff2", importance: "low" as const }
  ];

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>HTTP/2 Verb Server</title>
      <link rel="stylesheet" href="/styles/critical.css">
    </head>
    <body>
      <h1>Welcome to HTTP/2 with Verb!</h1>
      <p>This page is served over HTTP/2 with server push optimization.</p>
      <div class="features">
        <h2>HTTP/2 Features Demonstrated:</h2>
        <ul>
          <li>✅ Server Push (resources preloaded)</li>
          <li>✅ Header Compression (HPACK)</li>
          <li>✅ Stream Multiplexing</li>
          <li>✅ Binary Protocol</li>
        </ul>
      </div>
      <script src="/js/app.js"></script>
    </body>
    </html>
  `;

  return responseWithPush(htmlContent, criticalResources, {
    headers: { "Content-Type": "text/html" }
  });
});

// API endpoint with custom HTTP/2 headers
app.get("/api/data", () => {
  const headers = createHttp2Headers(StreamPriority.HIGH, "no-cache");
  headers.set("Content-Type", "application/json");

  return new Response(JSON.stringify({
    message: "High priority API response",
    timestamp: new Date().toISOString(),
    protocol: "HTTP/2"
  }), { headers });
});

// Static CSS with aggressive caching
app.get("/styles/critical.css", () => {
  const css = `
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      line-height: 1.6;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      color: #333;
    }
    
    h1 {
      color: #2563eb;
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 10px;
    }
    
    .features {
      background: #f8fafc;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
    }
    
    .features ul {
      list-style: none;
      padding: 0;
    }
    
    .features li {
      padding: 5px 0;
      font-weight: 500;
    }
  `;

  const headers = createHttp2Headers(StreamPriority.MEDIUM, "public, max-age=31536000, immutable");
  headers.set("Content-Type", "text/css");

  return new Response(css, { headers });
});

// JavaScript with medium priority
app.get("/js/app.js", () => {
  const js = `
    console.log('HTTP/2 JavaScript loaded via server push!');
    
    // Demonstrate fetch over HTTP/2 multiplexing
    async function loadData() {
      try {
        const response = await fetch('/api/data');
        const data = await response.json();
        console.log('API data loaded:', data);
        
        // Update page with fetched data
        const timestamp = document.createElement('p');
        timestamp.textContent = 'Last updated: ' + data.timestamp;
        timestamp.style.fontStyle = 'italic';
        timestamp.style.color = '#666';
        document.body.appendChild(timestamp);
      } catch (error) {
        console.error('Failed to load data:', error);
      }
    }
    
    // Load data after page loads
    document.addEventListener('DOMContentLoaded', loadData);
  `;

  const headers = createHttp2Headers(StreamPriority.MEDIUM, "public, max-age=86400");
  headers.set("Content-Type", "application/javascript");

  return new Response(js, { headers });
});

// Font file with low priority
app.get("/fonts/main.woff2", () => {
  // In a real application, you would serve actual font data
  const headers = createHttp2Headers(StreamPriority.LOW, "public, max-age=31536000, immutable");
  headers.set("Content-Type", "font/woff2");
  
  return new Response(new ArrayBuffer(0), { headers });
});

// Health check endpoint
app.get("/health", () => {
  return text("HTTP/2 server is healthy! 🚀");
});

// Benchmark endpoint for performance testing
app.get("/benchmark", () => {
  const headers = createHttp2Headers(StreamPriority.HIGH, "no-cache");
  headers.set("Content-Type", "application/json");

  const data = {
    server: "Verb HTTP/2",
    timestamp: Date.now(),
    protocol: "HTTP/2",
    features: [
      "Server Push",
      "Header Compression",
      "Stream Multiplexing",
      "Binary Protocol"
    ]
  };

  return new Response(JSON.stringify(data), { headers });
});

console.log("🚀 HTTP/2 server starting...");
console.log("📝 Make sure you have cert.pem and key.pem in the current directory");
console.log("🌐 Visit https://localhost:3443/ (note: HTTPS, not HTTP)");
console.log("⚠️  You may need to accept the self-signed certificate in your browser");
