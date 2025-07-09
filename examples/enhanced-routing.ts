import { createServer, Router } from "../src/index";
import type { Request, Response } from "../src/index";

const app = createServer();

// Basic enhanced routing examples
console.log("🚀 Enhanced Routing Demo Server");

// 1. Route with regex parameters
app.get('/users/:id(\\d+)', (req: Request, res: Response) => {
  res.json({ 
    message: 'User with numeric ID',
    userId: req.params?.id,
    type: 'numeric'
  });
});

// 2. Wildcard routes
app.get('/files/*', (req: Request, res: Response) => {
  res.json({ 
    message: 'File access',
    filePath: req.params?.['*'] || req.params?.['0'], // Wildcard captured as index 0
    url: req.url
  });
});

// 3. Route arrays - multiple paths for same handler
app.get(['/api', '/api/v1', '/api/version'], (req: Request, res: Response) => {
  res.json({
    message: 'API endpoint',
    path: new URL(req.url).pathname,
    note: 'This handler responds to multiple paths'
  });
});

// 4. Verb Router usage
const userRouter = Router();

userRouter.get('/', (_req: Request, res: Response) => {
  res.json({ message: 'All users', users: [] });
});

userRouter.get('/:id', (req: Request, res: Response) => {
  res.json({ 
    message: 'Single user',
    userId: req.params?.id 
  });
});

userRouter.post('/', (req: Request, res: Response) => {
  res.json({ 
    message: 'User created',
    data: req.body 
  });
});

// Mount the router
app.use('/users', userRouter as any);

// 5. Verb Router with options
const adminRouter = Router({ 
  caseSensitive: true,
  strict: true 
});

adminRouter.get('/dashboard', (_req: Request, res: Response) => {
  res.json({ message: 'Admin dashboard' });
});

adminRouter.get('/users/:id(\\d+)', (req: Request, res: Response) => {
  res.json({ 
    message: 'Admin user view',
    userId: req.params?.id,
    admin: true
  });
});

// Mount admin router
app.use('/admin', adminRouter as any);

// 6. Route method chaining
app.route('/products/:id')
  .get((req: Request, res: Response) => {
    res.json({ 
      message: 'Get product',
      productId: req.params?.id 
    });
  })
  .put((req: Request, res: Response) => {
    res.json({ 
      message: 'Update product',
      productId: req.params?.id,
      data: req.body
    });
  })
  .delete((req: Request, res: Response) => {
    res.json({ 
      message: 'Delete product',
      productId: req.params?.id 
    });
  });

// 7. Complex route patterns
app.get('/api/:version(v\\d+)/users/:userId(\\d+)/posts/:postId(\\d+)', (req: Request, res: Response) => {
  res.json({
    message: 'Complex nested route',
    version: req.params?.version,
    userId: req.params?.userId,
    postId: req.params?.postId
  });
});

// 8. Static HTML for testing
const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Enhanced Routing Demo</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .endpoint { 
            background: #f0f0f0; 
            padding: 10px; 
            margin: 10px 0; 
            border-radius: 5px; 
        }
        .method { 
            font-weight: bold; 
            color: #4CAF50; 
        }
        .path { 
            font-family: monospace; 
            background: #e0e0e0; 
            padding: 2px 6px; 
            border-radius: 3px; 
        }
    </style>
</head>
<body>
    <h1>🚀 Enhanced Routing Demo</h1>
    <p>Test these enhanced routing features:</p>
    
    <h2>1. Regex Parameters</h2>
    <div class="endpoint">
        <span class="method">GET</span> 
        <span class="path">/users/:id(\\d+)</span> - Only matches numeric IDs
    </div>
    <ul>
        <li><a href="/users/123">/users/123</a> ✅</li>
        <li><a href="/users/abc">/users/abc</a> ❌ (404)</li>
    </ul>

    <h2>2. Wildcard Routes</h2>
    <div class="endpoint">
        <span class="method">GET</span> 
        <span class="path">/files/*</span> - Matches any file path
    </div>
    <ul>
        <li><a href="/files/documents/report.pdf">/files/documents/report.pdf</a></li>
        <li><a href="/files/images/photo.jpg">/files/images/photo.jpg</a></li>
    </ul>

    <h2>3. Route Arrays</h2>
    <div class="endpoint">
        <span class="method">GET</span> 
        <span class="path">['/api', '/api/v1', '/api/version']</span> - Multiple paths, same handler
    </div>
    <ul>
        <li><a href="/api">/api</a></li>
        <li><a href="/api/v1">/api/v1</a></li>
        <li><a href="/api/version">/api/version</a></li>
    </ul>

    <h2>4. Router Mounting</h2>
    <div class="endpoint">
        <span class="method">GET</span> 
        <span class="path">/users/*</span> - Mounted router
    </div>
    <ul>
        <li><a href="/users">/users</a> - All users</li>
        <li><a href="/users/456">/users/456</a> - Single user</li>
    </ul>

    <h2>5. Admin Router (Case Sensitive)</h2>
    <div class="endpoint">
        <span class="method">GET</span> 
        <span class="path">/admin/*</span> - Case sensitive router
    </div>
    <ul>
        <li><a href="/admin/dashboard">/admin/dashboard</a></li>
        <li><a href="/admin/users/789">/admin/users/789</a></li>
    </ul>

    <h2>6. Route Chaining</h2>
    <div class="endpoint">
        <span class="method">GET/PUT/DELETE</span> 
        <span class="path">/products/:id</span> - Multiple methods on same route
    </div>
    <ul>
        <li><a href="/products/100">/products/100</a> (GET)</li>
    </ul>

    <h2>7. Complex Patterns</h2>
    <div class="endpoint">
        <span class="method">GET</span> 
        <span class="path">/api/:version(v\\d+)/users/:userId(\\d+)/posts/:postId(\\d+)</span>
    </div>
    <ul>
        <li><a href="/api/v1/users/123/posts/456">/api/v1/users/123/posts/456</a></li>
        <li><a href="/api/v2/users/789/posts/101">/api/v2/users/789/posts/101</a></li>
    </ul>

    <h2>Testing with curl</h2>
    <pre>
# Test POST with route chaining
curl -X POST http://localhost:3000/products/100 \\
  -H "Content-Type: application/json" \\
  -d '{"name": "Product Name"}'

# Test PUT
curl -X PUT http://localhost:3000/products/100 \\
  -H "Content-Type: application/json" \\
  -d '{"name": "Updated Name"}'

# Test DELETE
curl -X DELETE http://localhost:3000/products/100
    </pre>
</body>
</html>
`;

app.get('/', (_req: Request, res: Response) => {
  res.html(html);
});

// Error handling for unmatched routes
app.get('*', (req: Request, res: Response) => {
  res.status(404).json({
    error: 'Route not found',
    path: new URL(req.url).pathname,
    message: 'This path does not match any of our enhanced routing patterns'
  });
});

const _server = app.listen(3000);
console.log("Server running on http://localhost:3000");
console.log("Visit http://localhost:3000 to see the enhanced routing demo");