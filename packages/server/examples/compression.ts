import { 
  createServer, 
  json, 
  text, 
  html, 
  compression, 
  gzip, 
  productionCompression 
} from "../src/index.ts";

// Create server with compression middleware
const app = createServer({ port: 3000 });

// Add compression middleware with default settings
app.use(compression());

// Alternative: Use production-optimized compression
// app.use(productionCompression());

// Alternative: Use only gzip compression
// app.use(gzip(9, 512)); // Max compression, 512 byte threshold

// Routes that will benefit from compression

// Large JSON response
app.get("/api/users", () => {
  const users = Array.from({ length: 1000 }, (_, i) => ({
    id: i + 1,
    name: `User ${i + 1}`,
    email: `user${i + 1}@example.com`,
    bio: "This is a long user bio that contains lots of text and will compress well. ".repeat(5),
    preferences: {
      theme: "dark",
      language: "en",
      notifications: true,
      privacy: "public"
    }
  }));
  
  return json(users);
});

// Large text response
app.get("/lorem", () => {
  const lorem = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(200);
  return text(lorem);
});

// HTML page with lots of content
app.get("/", () => {
  const content = Array.from({ length: 100 }, (_, i) => 
    `<p>This is paragraph ${i + 1} with some content that will compress nicely.</p>`
  ).join("\n");
  
  return html(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Compression Example</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; }
          .stats { background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .endpoint { margin: 20px 0; }
          code { background: #e1e1e1; padding: 2px 4px; border-radius: 3px; }
        </style>
      </head>
      <body>
        <h1>Verb Compression Example</h1>
        
        <div class="stats">
          <h3>Compression Benefits</h3>
          <p>This page and its API endpoints use automatic compression middleware.</p>
          <p>Large responses are automatically compressed with gzip or deflate based on client support.</p>
        </div>
        
        <div class="endpoint">
          <h3>Test Endpoints</h3>
          <ul>
            <li><a href="/api/users"><code>GET /api/users</code></a> - Large JSON array (1000 users)</li>
            <li><a href="/lorem"><code>GET /lorem</code></a> - Large text response</li>
            <li><a href="/"><code>GET /</code></a> - This HTML page</li>
          </ul>
        </div>
        
        <div class="endpoint">
          <h3>Testing Compression</h3>
          <p>Use browser dev tools or curl to see compression in action:</p>
          <pre><code>curl -H "Accept-Encoding: gzip" http://localhost:3000/api/users -v</code></pre>
          <p>Look for the <code>Content-Encoding: gzip</code> header in the response.</p>
        </div>
        
        ${content}
      </body>
    </html>
  `);
});

// Small response that won't be compressed (below threshold)
app.get("/small", () => {
  return json({ message: "small" });
});

// Binary content that won't be compressed
app.get("/image", () => {
  return new Response("fake binary image data", {
    headers: { "Content-Type": "image/jpeg" }
  });
});

console.log("🚀 Compression example server running at http://localhost:3000");
console.log("📊 Check browser dev tools to see compression headers");
console.log("🔧 Try different Accept-Encoding headers to test compression negotiation");
