import { createServer } from '../src/index';
import type { VerbRequest, VerbResponse } from '../src/types';

const app = createServer();

// Add various types of routes to demonstrate showRoutes
app.get('/', (_req: VerbRequest, res: VerbResponse) => {
  res.send('Welcome to Verb!');
});
app.get('/hello', (_req: VerbRequest, res: VerbResponse) => {
  res.send('Hello, World!');
});
app.get('/users/:id', (req: VerbRequest, res: VerbResponse) => {
  const { id } = req.params || {};
  res.json({ userId: id });
});
app.get('/users/:id/posts/:postId', (req: VerbRequest, res: VerbResponse) => {
  const { id, postId } = req.params || {};
  res.json({ userId: id, postId });
});
app.post('/users', async (req: VerbRequest, res: VerbResponse) => {
  const body = await req.json();
  res.json({ created: body });
});
app.put('/users/:id', async (req: VerbRequest, res: VerbResponse) => {
  const { id } = req.params || {};
  const body = await req.json();
  res.json({ updated: id, data: body });
});
app.delete('/users/:id', (req: VerbRequest, res: VerbResponse) => {
  const { id } = req.params || {};
  res.json({ deleted: id });
});

// Configure with showRoutes enabled
app.withOptions({
  port: 3000,
  hostname: 'localhost',
  showRoutes: true,
  development: {
    hmr: true,
    console: true
  }
});

// Start server (will automatically show routes)
app.listen();

console.log('🚀 Verb server running on http://localhost:3000');
console.log('Routes are displayed above thanks to showRoutes: true');