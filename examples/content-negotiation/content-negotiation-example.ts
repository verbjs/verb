import { createServer } from '../../src/index';
import { 
  MIME_TYPES, 
  CHARSETS, 
  ENCODINGS, 
  LANGUAGES,
  respondWithBestFormat,
  respondWithLanguage
} from '../../src/content-negotiation';
import type { VerbRequest, VerbResponse } from '../../src/types';

const app = createServer();

// Example 1: Basic content negotiation
app.get('/api/users', (req: VerbRequest, res: VerbResponse) => {
  const users = [
    { id: 1, name: 'Alice', email: 'alice@example.com' },
    { id: 2, name: 'Bob', email: 'bob@example.com' },
    { id: 3, name: 'Charlie', email: 'charlie@example.com' }
  ];

  // Check what content types the client accepts
  const acceptedType = req.accepts?.([MIME_TYPES.JSON, MIME_TYPES.XML, MIME_TYPES.HTML]);
  
  console.log('Client accepts:', acceptedType);
  
  switch (acceptedType) {
    case MIME_TYPES.JSON:
      res.header('Content-Type', MIME_TYPES.JSON);
      res.json(users);
      break;
      
    case MIME_TYPES.XML:
      res.header('Content-Type', MIME_TYPES.XML);
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<users>
  ${users.map(user => `
  <user>
    <id>${user.id}</id>
    <name>${user.name}</name>
    <email>${user.email}</email>
  </user>`).join('')}
</users>`;
      res.send(xml);
      break;
      
    case MIME_TYPES.HTML:
      res.header('Content-Type', MIME_TYPES.HTML);
      const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Users</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <h1>Users</h1>
    <table>
        <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Email</th>
        </tr>
        ${users.map(user => `
        <tr>
            <td>${user.id}</td>
            <td>${user.name}</td>
            <td>${user.email}</td>
        </tr>`).join('')}
    </table>
</body>
</html>`;
      res.send(html);
      break;
      
    default:
      res.status(406).json({ error: 'Not Acceptable' });
  }
});

// Example 2: Charset negotiation
app.get('/api/text', (req: VerbRequest, res: VerbResponse) => {
  const text = 'Hello, World! 你好世界! مرحبا بالعالم!';
  
  const acceptedCharset = req.acceptsCharsets?.([CHARSETS.UTF8, CHARSETS.UTF16, CHARSETS.ISO_8859_1]);
  
  console.log('Client accepts charset:', acceptedCharset);
  
  res.header('Content-Type', `text/plain; charset=${acceptedCharset || CHARSETS.UTF8}`);
  res.send(text);
});

// Example 3: Encoding negotiation
app.get('/api/large-data', (req: VerbRequest, res: VerbResponse) => {
  const largeData = {
    message: 'This is a large response that would benefit from compression',
    data: Array.from({ length: 1000 }, (_, i) => ({
      id: i + 1,
      value: `Item ${i + 1}`,
      description: `This is item number ${i + 1} in the large dataset`
    }))
  };
  
  const acceptedEncoding = req.acceptsEncodings?.([ENCODINGS.GZIP, ENCODINGS.DEFLATE, ENCODINGS.BROTLI]);
  
  console.log('Client accepts encoding:', acceptedEncoding);
  
  if (acceptedEncoding && acceptedEncoding !== ENCODINGS.IDENTITY) {
    res.header('Content-Encoding', acceptedEncoding);
    console.log(`Would compress response with ${acceptedEncoding}`);
  }
  
  res.json(largeData);
});

// Example 4: Language negotiation
app.get('/api/greeting', (req: VerbRequest, res: VerbResponse) => {
  const translations = {
    [LANGUAGES.EN]: { message: 'Hello!', description: 'Welcome to our API' },
    [LANGUAGES.EN_US]: { message: 'Hello!', description: 'Welcome to our API' },
    [LANGUAGES.EN_GB]: { message: 'Hello!', description: 'Welcome to our API' },
    [LANGUAGES.ES]: { message: '¡Hola!', description: 'Bienvenido a nuestra API' },
    [LANGUAGES.FR]: { message: 'Bonjour!', description: 'Bienvenue dans notre API' },
    [LANGUAGES.DE]: { message: 'Hallo!', description: 'Willkommen zu unserer API' },
    [LANGUAGES.ZH]: { message: '你好!', description: '欢迎使用我们的API' },
    [LANGUAGES.JA]: { message: 'こんにちは!', description: '私たちのAPIへようこそ' }
  };
  
  const acceptedLanguage = req.acceptsLanguages?.(Object.keys(translations));
  
  console.log('Client accepts language:', acceptedLanguage);
  
  const selectedTranslation = translations[acceptedLanguage as keyof typeof translations] || translations[LANGUAGES.EN];
  
  res.header('Content-Language', acceptedLanguage || LANGUAGES.EN);
  res.json(selectedTranslation);
});

// Example 5: Combined content negotiation using utility function
app.get('/api/product/:id', (req: VerbRequest, res: VerbResponse) => {
  const product = {
    id: parseInt(req.params?.id || '1'),
    name: 'Example Product',
    price: 99.99,
    description: 'This is an example product',
    inStock: true
  };
  
  const formats = {
    [MIME_TYPES.JSON]: (data: any) => JSON.stringify(data, null, 2),
    [MIME_TYPES.XML]: (data: any) => `<?xml version="1.0" encoding="UTF-8"?>
<product>
  <id>${data.id}</id>
  <name>${data.name}</name>
  <price>${data.price}</price>
  <description>${data.description}</description>
  <inStock>${data.inStock}</inStock>
</product>`,
    [MIME_TYPES.HTML]: (data: any) => `
<!DOCTYPE html>
<html>
<head>
    <title>${data.name}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .product { border: 1px solid #ddd; padding: 20px; border-radius: 8px; }
        .price { color: #e74c3c; font-size: 1.2em; font-weight: bold; }
        .stock { color: #27ae60; }
    </style>
</head>
<body>
    <div class="product">
        <h1>${data.name}</h1>
        <p><strong>ID:</strong> ${data.id}</p>
        <p><strong>Price:</strong> <span class="price">$${data.price}</span></p>
        <p><strong>Description:</strong> ${data.description}</p>
        <p><strong>In Stock:</strong> <span class="stock">${data.inStock ? 'Yes' : 'No'}</span></p>
    </div>
</body>
</html>`
  };
  
  const result = respondWithBestFormat(req, product, formats);
  
  res.header('Content-Type', result.contentType);
  res.send(result.content);
});

// Example 6: Language-aware response
app.get('/api/welcome', (req: VerbRequest, res: VerbResponse) => {
  const translations = {
    [LANGUAGES.EN]: { 
      title: 'Welcome',
      message: 'Welcome to our multilingual API!',
      instructions: 'Use the Accept-Language header to get responses in your preferred language.'
    },
    [LANGUAGES.ES]: { 
      title: 'Bienvenido',
      message: '¡Bienvenido a nuestra API multilingüe!',
      instructions: 'Usa el encabezado Accept-Language para obtener respuestas en tu idioma preferido.'
    },
    [LANGUAGES.FR]: { 
      title: 'Bienvenue',
      message: 'Bienvenue dans notre API multilingue!',
      instructions: 'Utilisez l\'en-tête Accept-Language pour obtenir des réponses dans votre langue préférée.'
    },
    [LANGUAGES.DE]: { 
      title: 'Willkommen',
      message: 'Willkommen zu unserer mehrsprachigen API!',
      instructions: 'Verwenden Sie den Accept-Language-Header, um Antworten in Ihrer bevorzugten Sprache zu erhalten.'
    }
  };
  
  const result = respondWithLanguage(req, translations);
  
  res.header('Content-Language', result.language);
  res.json(result.content);
});

// Example 7: Content negotiation debugging
app.get('/debug/headers', (req: VerbRequest, res: VerbResponse) => {
  const debugInfo = {
    acceptedTypes: req.accepts?.(),
    acceptedCharsets: req.acceptsCharsets?.(),
    acceptedEncodings: req.acceptsEncodings?.(),
    acceptedLanguages: req.acceptsLanguages?.(),
    headers: {
      accept: req.headers.get('accept'),
      acceptCharset: req.headers.get('accept-charset'),
      acceptEncoding: req.headers.get('accept-encoding'),
      acceptLanguage: req.headers.get('accept-language')
    },
    negotiation: {
      bestType: req.accepts?.([MIME_TYPES.JSON, MIME_TYPES.HTML, MIME_TYPES.XML]),
      bestCharset: req.acceptsCharsets?.([CHARSETS.UTF8, CHARSETS.UTF16, CHARSETS.ISO_8859_1]),
      bestEncoding: req.acceptsEncodings?.([ENCODINGS.GZIP, ENCODINGS.DEFLATE, ENCODINGS.BROTLI]),
      bestLanguage: req.acceptsLanguages?.([LANGUAGES.EN, LANGUAGES.ES, LANGUAGES.FR, LANGUAGES.DE])
    }
  };
  
  res.json(debugInfo);
});

// Example 8: API versioning using content negotiation
app.get('/api/status', (req: VerbRequest, res: VerbResponse) => {
  // Check for API version in Accept header
  const acceptedTypes = req.accepts?.();
  const apiVersion = acceptedTypes?.find(type => type.includes('application/vnd.api+json'))?.includes('version=2') ? 'v2' : 'v1';
  
  const responses = {
    v1: {
      status: 'ok',
      version: '1.0',
      server: 'Verb Framework'
    },
    v2: {
      status: 'healthy',
      version: '2.0',
      server: 'Verb Framework',
      uptime: process.uptime(),
      memory: process.memoryUsage()
    }
  };
  
  res.header('Content-Type', `application/vnd.api+json; version=${apiVersion === 'v2' ? '2' : '1'}`);
  res.json(responses[apiVersion]);
});

// Example 9: Documentation endpoint
app.get('/', (req: VerbRequest, res: VerbResponse) => {
  res.json({
    name: 'Content Negotiation Example API',
    version: '1.0.0',
    description: 'Demonstrates content negotiation capabilities',
    endpoints: {
      'GET /api/users': 'Returns user list (supports JSON, XML, HTML)',
      'GET /api/text': 'Returns text with charset negotiation',
      'GET /api/large-data': 'Returns large dataset with encoding negotiation',
      'GET /api/greeting': 'Returns greeting in preferred language',
      'GET /api/product/:id': 'Returns product using format negotiation utility',
      'GET /api/welcome': 'Returns welcome message using language utility',
      'GET /debug/headers': 'Shows all negotiation debug information',
      'GET /api/status': 'API status with version negotiation'
    },
    examples: {
      'JSON response': 'curl -H "Accept: application/json" http://localhost:3000/api/users',
      'HTML response': 'curl -H "Accept: text/html" http://localhost:3000/api/users',
      'XML response': 'curl -H "Accept: application/xml" http://localhost:3000/api/users',
      'Spanish language': 'curl -H "Accept-Language: es" http://localhost:3000/api/greeting',
      'French language': 'curl -H "Accept-Language: fr" http://localhost:3000/api/greeting',
      'UTF-16 charset': 'curl -H "Accept-Charset: utf-16" http://localhost:3000/api/text',
      'Gzip encoding': 'curl -H "Accept-Encoding: gzip" http://localhost:3000/api/large-data',
      'Combined negotiation': 'curl -H "Accept: text/html" -H "Accept-Language: es" http://localhost:3000/api/welcome'
    }
  });
});

const port = 3000;
app.withOptions({
  port,
  hostname: 'localhost',
  development: {
    hmr: true,
    console: true
  }
});

app.listen();

console.log(`🚀 Content negotiation example server running on http://localhost:${port}`);
console.log('\\nContent negotiation features:');
console.log('✅ req.accepts() - Content type negotiation');
console.log('✅ req.acceptsCharsets() - Charset negotiation');
console.log('✅ req.acceptsEncodings() - Encoding negotiation');
console.log('✅ req.acceptsLanguages() - Language negotiation');
console.log('✅ Utility functions for best format selection');
console.log('✅ Language-aware responses');
console.log('✅ API versioning via content negotiation');
console.log('\\nTesting suggestions:');
console.log('1. Visit http://localhost:3000 for API documentation');
console.log('2. Try different Accept headers to see content negotiation in action');
console.log('3. Test language negotiation with Accept-Language header');
console.log('4. Test charset and encoding negotiation');
console.log('5. Use /debug/headers to see all negotiation information');
console.log('\\nExample commands:');
console.log('curl -H "Accept: application/json" http://localhost:3000/api/users');
console.log('curl -H "Accept: text/html" http://localhost:3000/api/users');
console.log('curl -H "Accept-Language: es" http://localhost:3000/api/greeting');
console.log('curl -H "Accept-Language: fr,en;q=0.9" http://localhost:3000/api/welcome');
console.log('curl -H "Accept-Charset: utf-16" http://localhost:3000/api/text');
console.log('curl -H "Accept-Encoding: gzip,deflate" http://localhost:3000/api/large-data');