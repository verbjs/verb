import { createServer } from '../src/index';
import type { Request, Response } from '../src/index';

const app = createServer();

app.get('/', (_req: Request, res: Response) => {
  res.send('Hello with HMR!');
});
app.get('/test', (_req: Request, res: Response) => {
  res.send('Test endpoint');
});

// Method 1: Use withOptions (recommended)
app.withOptions({
  port: 3000,
  hostname: 'localhost',
  development: {
    hmr: true,
    console: true
  }
});
app.listen();

// Method 2: Direct port/hostname (basic)
// app.listen(3000, 'localhost');

console.log('🚀 Verb server running on http://localhost:3000 with HMR enabled!');
console.log('Try editing this file - it should hot reload automatically');