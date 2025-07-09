import { createServer } from '../../src/index';
import type { Request, Response } from '../../src/index';

// Import HTML file - Bun will handle bundling automatically  
import * as indexHTML from './index.html';

const app = createServer();

// API routes using traditional Verb routing
app.get('/api/hello', (_req: Request, res: Response) => {
  res.json({ message: 'Hello from Verb API!' });
});

app.get('/api/users/:id', (req: Request, res: Response) => {
  const { id } = req.params || {};
  res.json({ 
    id, 
    name: `User ${id}`, 
    email: `user${id}@example.com` 
  });
});

// Configure server with HTML routes for Bun's native bundling
app.withRoutes({
  '/': indexHTML,
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