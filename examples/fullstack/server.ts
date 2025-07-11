import { createServer } from '../../src/index';

// Import HTML file - Bun will handle bundling automatically  
// @ts-ignore - HTML imports work with Bun but TypeScript doesn't recognize them
import indexHTML from './index.html';

const app = createServer();

// Configure server with HTML routes for Bun's native bundling
app.withRoutes({
  // ** HTML imports **
  // Bundle & route index.html to "/". This uses HTMLRewriter to scan the HTML for `<script>` and `<link>` tags, 
  // runs Bun's JavaScript & CSS bundler on them, transpiles any TypeScript, JSX, and TSX, 
  // downlevels CSS with Bun's CSS parser and serves the result.
  '/': indexHTML,
  
  // ** API endpoints ** (Verb + Bun v1.2.3+ pattern)
  '/api/hello': {
    GET: () => Response.json({ message: 'Hello from Verb API!' })
  },
  '/api/users/:id': {
    GET: (req: Request) => {
      const url = new URL(req.url);
      const id = url.pathname.split('/')[3];
      return Response.json({ 
        id, 
        name: `User ${id}`, 
        email: `user${id}@example.com` 
      });
    }
  },
  
  // Health check endpoint
  '/api/health': async () => {
    return Response.json({ 
      status: "healthy", 
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage()
    });
  }
});

// Configure server options
app.withOptions({
  port: 3000,
  hostname: 'localhost',
  showRoutes: true,
  development: {
    hmr: true,
    console: true
  }
});

// Start server
app.listen();

console.log('🚀 Verb fullstack server running on http://localhost:3000');
console.log('Features:');
console.log('  - HTML imports with automatic bundling');
console.log('  - React/TSX support'); 
console.log('  - CSS bundling');
console.log('  - HMR enabled');
console.log('  - API routes at /api/*');