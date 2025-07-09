import { createServer } from '../src/index';
import type { Request, Response } from '../src/index';

const app = createServer();

// Global middleware - runs on every request
app.use((req: Request, _res: Response, next: () => void) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Global authentication middleware
app.use((req: Request, res: Response, next: () => void) => {
  const authHeader = req.headers.get('authorization');
  if (!authHeader && req.url.includes('/protected')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
});

// Path-specific middleware - only runs for /api/* routes
app.use('/api', (_req: Request, res: Response, next: () => void) => {
  console.log('API middleware executed');
  res.header('X-API-Version', '1.0');
  next();
});

// Route-specific middleware
const requireAuth = (req: Request, res: Response, next: () => void) => {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token || token !== 'valid-token') {
    res.status(401).json({ error: 'Invalid token' });
    return;
  }
  next();
};

const logAccess = (req: Request, _res: Response, next: () => void) => {
  console.log(`Accessing protected route: ${req.url}`);
  next();
};

// Public routes
app.get('/', (_req: Request, res: Response) => {
  res.json({ message: 'Welcome to Verb with Middleware!' });
});

app.get('/public', (_req: Request, res: Response) => {
  res.json({ message: 'This is a public endpoint' });
});

// API routes (will trigger /api middleware)
app.get('/api/users', (_req: Request, res: Response) => {
  res.json({ users: ['Alice', 'Bob', 'Charlie'] });
});

app.get('/api/status', (_req: Request, res: Response) => {
  res.json({ status: 'API is running', timestamp: Date.now() });
});

// Protected routes with route-specific middleware
app.get('/protected', requireAuth, (_req: Request, res: Response) => {
  res.json({ message: 'This is a protected endpoint', user: 'authenticated' });
});

app.get('/admin', requireAuth, logAccess, (_req: Request, res: Response) => {
  res.json({ message: 'Admin panel', permissions: ['read', 'write', 'delete'] });
});

// Multiple middleware on a single route
app.post('/api/sensitive', requireAuth, logAccess, (_req: Request, res: Response) => {
  res.json({ message: 'Sensitive operation completed' });
});

// Error handling example
app.get('/error', (_req: Request, _res: Response) => {
  throw new Error('Intentional error for testing');
});

const port = 3000;
app.listen(port);

console.log(`🚀 Verb server with middleware running on http://localhost:${port}`);
console.log(`
Middleware Examples:
  GET    /                     - Global middleware only
  GET    /public               - Global middleware only  
  GET    /api/users            - Global + /api path middleware
  GET    /api/status           - Global + /api path middleware
  GET    /protected            - Global + requireAuth middleware (needs: Authorization: Bearer valid-token)
  GET    /admin                - Global + requireAuth + logAccess middleware
  POST   /api/sensitive        - Global + /api + requireAuth + logAccess middleware
  GET    /error                - Error handling test

Try these curl commands:
  curl http://localhost:3000/
  curl http://localhost:3000/api/users
  curl -H "Authorization: Bearer valid-token" http://localhost:3000/protected
  curl -H "Authorization: Bearer invalid" http://localhost:3000/protected
`);