import { createServer } from '../src/index';
import type { Request, Response } from '../src/index';

const app = createServer();

// Basic routes
app.get('/', (_req: Request, res: Response) => {
  res.send('Welcome to Verb!');
});

app.get('/hello', (_req: Request, res: Response) => {
  res.send('Hello, World!');
});

app.get('/json', (_req: Request, res: Response) => {
  res.json({ message: 'Hello JSON!', timestamp: Date.now() });
});

// Path parameters
app.get('/users/:id', (req: Request, res: Response) => {
  const { id } = req.params || {};
  res.json({ userId: id, message: `User ${id} profile` });
});

app.get('/users/:id/posts/:postId', (req: Request, res: Response) => {
  const { id, postId } = req.params || {};
  res.json({ 
    userId: id, 
    postId, 
    message: `Post ${postId} by user ${id}` 
  });
});

// Query parameters
app.get('/search', (req: Request, res: Response) => {
  const { q, limit = '10' } = req.query || {};
  res.json({ 
    query: q, 
    limit: parseInt(limit),
    results: q ? [`Result for "${q}"`] : []
  });
});

// POST with JSON body
app.post('/users', async (req: Request, res: Response) => {
  try {
    const body = await req.json();
    res.status(201).json({ 
      message: 'User created successfully',
      user: { id: Math.random().toString(36), ...body }
    });
  } catch {
    res.status(400).json({ error: 'Invalid JSON' });
  }
});

// PUT request
app.put('/users/:id', async (req: Request, res: Response) => {
  const { id } = req.params || {};
  try {
    const body = await req.json();
    res.json({ 
      message: `User ${id} updated`,
      user: { id, ...body }
    });
  } catch {
    res.status(400).json({ error: 'Invalid JSON' });
  }
});

// DELETE request
app.delete('/users/:id', (req: Request, res: Response) => {
  const { id } = req.params || {};
  res.json({ message: `User ${id} deleted` });
});

// Error handling example
app.get('/error', (_req: Request, _res: Response) => {
  throw new Error('Test error');
});

// Start server
const port = 3000;
app.listen(port);
console.log(`🚀 Verb server running on http://localhost:${port}`);
console.log(`
Available endpoints:
  GET    /                     - Welcome message
  GET    /hello                - Hello world
  GET    /json                 - JSON response
  GET    /users/:id            - Get user by ID
  GET    /users/:id/posts/:postId - Get user's post
  GET    /search?q=term&limit=5 - Search with query params
  POST   /users               - Create user (JSON body)
  PUT    /users/:id           - Update user (JSON body)
  DELETE /users/:id           - Delete user
  GET    /error               - Test error handling
`);