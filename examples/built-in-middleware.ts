import { createServer, middleware } from '../src/index';
import type { Request, Response } from '../src/index';

const app = createServer();

// JSON body parsing middleware
app.use(middleware.json({ limit: '1mb' }));

// URL-encoded form parsing middleware
app.use(middleware.urlencoded({ extended: true, limit: '1mb' }));

// Static file serving middleware
app.use('/static', middleware.staticFiles('./examples/static', {
  maxAge: 3600, // 1 hour cache
  dotfiles: 'ignore',
  index: 'index.html',
  etag: true
}));

// Routes that use parsed body data
app.get('/', (_req: Request, res: Response) => {
  res.html(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Built-in Middleware Demo</title>
      <link rel="stylesheet" href="/static/style.css">
    </head>
    <body>
      <h1>Verb Built-in Middleware Demo</h1>
      
      <section>
        <h2>JSON API Test</h2>
        <form id="jsonForm">
          <textarea placeholder="Enter JSON here" rows="4" cols="50">{"name": "John", "age": 30}</textarea>
          <br><button type="submit">Send JSON</button>
        </form>
        <pre id="jsonResult"></pre>
      </section>

      <section>
        <h2>Form Data Test</h2>
        <form action="/form" method="post">
          <input type="text" name="username" placeholder="Username" required>
          <input type="email" name="email" placeholder="Email" required>
          <input type="number" name="age" placeholder="Age">
          <input type="checkbox" name="newsletter" value="yes"> Subscribe to newsletter
          <br><button type="submit">Submit Form</button>
        </form>
      </section>

      <section>
        <h2>Text Upload Test</h2>
        <form id="textForm">
          <textarea placeholder="Enter plain text" rows="4" cols="50">Hello, this is plain text!</textarea>
          <br><button type="submit">Send Text</button>
        </form>
        <pre id="textResult"></pre>
      </section>

      <section>
        <h2>Static Files</h2>
        <p>Static files are served from <code>/static</code> path:</p>
        <ul>
          <li><a href="/static/test.txt">Test Text File</a></li>
          <li><a href="/static/sample.json">Sample JSON File</a></li>
          <li><a href="/static/style.css">CSS Stylesheet</a></li>
        </ul>
      </section>

      <script src="/static/demo.js"></script>
    </body>
    </html>
  `);
});

// JSON endpoint
app.post('/api/json', (req: Request, res: Response) => {
  console.log('Received JSON body:', req.body);
  res.json({
    message: 'JSON received successfully',
    received: req.body,
    type: typeof req.body,
    timestamp: new Date().toISOString()
  });
});

// Form endpoint
app.post('/form', (req: Request, res: Response) => {
  console.log('Received form data:', req.body);
  res.html(`
    <h1>Form Submission Result</h1>
    <p>Form data received:</p>
    <pre>${JSON.stringify(req.body, null, 2)}</pre>
    <a href="/">Back to Demo</a>
  `);
});

// Text endpoint using text middleware
app.post('/api/text', middleware.text({ type: 'text/plain' }), (req: Request, res: Response) => {
  console.log('Received text body:', req.body);
  res.json({
    message: 'Text received successfully',
    received: req.body,
    length: req.body.length,
    timestamp: new Date().toISOString()
  });
});

// Raw data endpoint using raw middleware  
app.post('/api/raw', middleware.raw({ type: 'application/octet-stream' }), (req: Request, res: Response) => {
  console.log('Received raw body:', req.body);
  res.json({
    message: 'Raw data received successfully',
    size: req.body.length,
    type: 'Buffer',
    timestamp: new Date().toISOString()
  });
});

// File upload using different middleware based on content type
app.post('/api/upload', 
  middleware.raw({ type: ['image/*', 'application/pdf'] }),
  middleware.text({ type: 'text/*' }),
  (req: Request, res: Response) => {
    const contentType = req.headers.get('content-type') || '';
    
    if (contentType.startsWith('text/')) {
      res.json({
        message: 'Text file received',
        content: req.body,
        size: req.body.length
      });
    } else {
      res.json({
        message: 'Binary file received',
        size: req.body.length,
        contentType
      });
    }
  }
);

// Error handling example
app.post('/api/large', middleware.json({ limit: '1kb' }), (_req: Request, res: Response) => {
  res.json({ message: 'This endpoint only accepts small JSON (max 1KB)' });
});

const port = 3000;
app.listen(port);

console.log(`🚀 Built-in Middleware Demo running on http://localhost:${port}`);
console.log(`
Features Demonstrated:
  GET    /                     - HTML demo page with forms
  POST   /api/json             - JSON body parsing (middleware.json)
  POST   /form                 - URL-encoded form parsing (middleware.urlencoded)
  POST   /api/text             - Text body parsing (middleware.text)
  POST   /api/raw              - Raw binary parsing (middleware.raw)
  POST   /api/upload           - Multiple parsers based on content-type
  POST   /api/large            - Size limit demonstration
  GET    /static/*             - Static file serving (middleware.static)

Try these commands:
  curl -X POST -H "Content-Type: application/json" -d '{"test": "data"}' http://localhost:3000/api/json
  curl -X POST -H "Content-Type: application/x-www-form-urlencoded" -d 'name=John&age=30' http://localhost:3000/form
  curl -X POST -H "Content-Type: text/plain" -d 'Hello World' http://localhost:3000/api/text
`);