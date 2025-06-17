import {
  createServer,
  json,
  schema,
  SchemaValidationError,
  validateSchema,
  type JsonSchema,
  type RouteSchema
} from "../src/index.ts";

// User registration schema
const userRegistrationSchema: RouteSchema = {
  body: {
    type: 'object',
    required: ['name', 'email', 'age'],
    properties: {
      name: {
        type: 'string',
        minLength: 2,
        maxLength: 50
      },
      email: {
        type: 'string',
        format: 'email'
      },
      age: {
        type: 'integer',
        minimum: 18,
        maximum: 120
      },
      preferences: {
        type: 'object',
        properties: {
          newsletter: { type: 'boolean' },
          theme: { type: 'string', enum: ['light', 'dark'] }
        },
        additionalProperties: false
      }
    },
    additionalProperties: false
  },
  response: {
    201: {
      type: 'object',
      properties: {
        id: { type: 'integer' },
        name: { type: 'string' },
        email: { type: 'string' },
        createdAt: { type: 'string' }
      }
    }
  }
};

// Product search schema
const productSearchSchema: RouteSchema = {
  query: {
    type: 'object',
    properties: {
      q: { type: 'string', minLength: 1 },
      category: { type: 'string', enum: ['electronics', 'books', 'clothing'] },
      minPrice: { type: 'number', minimum: 0 },
      maxPrice: { type: 'number', minimum: 0 },
      page: { type: 'integer', minimum: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 100 }
    }
  }
};

// Array validation schema
const batchUpdateSchema: RouteSchema = {
  body: {
    type: 'object',
    required: ['updates'],
    properties: {
      updates: {
        type: 'array',
        minItems: 1,
        maxItems: 100,
        items: {
          type: 'object',
          required: ['id', 'action'],
          properties: {
            id: { type: 'integer' },
            action: { type: 'string', enum: ['update', 'delete'] },
            data: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                status: { type: 'string', enum: ['active', 'inactive'] }
              }
            }
          }
        }
      }
    }
  }
};

const app = createServer({ port: 3001 });

// Global error handler for validation errors
app.use(async (req, next) => {
  try {
    return await next();
  } catch (error) {
    if (error instanceof SchemaValidationError) {
      return json({
        error: 'Validation failed',
        details: error.errors.map(e => ({
          field: e.field,
          message: e.message,
          value: e.value
        }))
      }, 400);
    }
    throw error;
  }
});

// Root endpoint with information
app.get('/', () => {
  return json({
    message: 'Schema Validation Demo',
    endpoints: {
      'POST /users': 'Register user with validation',
      'GET /products/search': 'Search products with query validation',
      'POST /batch': 'Batch operations with array validation',
      'POST /validate': 'Direct validation example'
    },
    examples: {
      validUser: {
        name: 'John Doe',
        email: 'john@example.com',
        age: 30,
        preferences: { newsletter: true, theme: 'dark' }
      },
      validSearch: '/products/search?q=laptop&category=electronics&minPrice=100&maxPrice=2000&page=1&limit=10',
      validBatch: {
        updates: [
          { id: 1, action: 'update', data: { name: 'Updated Name', status: 'active' } },
          { id: 2, action: 'delete' }
        ]
      }
    }
  });
});

// User registration with comprehensive validation
app.post('/users', schema(userRegistrationSchema)((req) => {
  const userData = (req as any).validatedBody;
  
  // Simulate user creation
  const user = {
    id: Math.floor(Math.random() * 1000),
    name: userData.name,
    email: userData.email,
    createdAt: new Date().toISOString()
  };

  console.log('✅ User created:', user);
  return json(user, 201);
}));

// Product search with query parameter validation
app.get('/products/search', schema(productSearchSchema)((req) => {
  const query = (req as any).validatedQuery || {};
  
  // Simulate product search
  const products = [
    { id: 1, name: 'Laptop', category: 'electronics', price: 1200 },
    { id: 2, name: 'Book', category: 'books', price: 25 },
    { id: 3, name: 'T-Shirt', category: 'clothing', price: 30 }
  ].filter(product => {
    if (query.category && product.category !== query.category) return false;
    if (query.minPrice && product.price < query.minPrice) return false;
    if (query.maxPrice && product.price > query.maxPrice) return false;
    if (query.q && !product.name.toLowerCase().includes(query.q.toLowerCase())) return false;
    return true;
  });

  console.log('🔍 Search performed:', { query, results: products.length });
  return json({
    products,
    total: products.length,
    page: query.page || 1,
    limit: query.limit || 10
  });
}));

// Batch operations with array validation
app.post('/batch', schema(batchUpdateSchema)((req) => {
  const { updates } = (req as any).validatedBody;
  
  const results = updates.map((update: any) => ({
    id: update.id,
    action: update.action,
    status: 'completed',
    timestamp: new Date().toISOString()
  }));

  console.log('📦 Batch operation completed:', { count: updates.length });
  return json({ results, summary: { total: updates.length, successful: results.length } });
}));

// Direct validation endpoint (for testing individual schemas)
app.post('/validate', async (req) => {
  try {
    const body = await req.json();
    const { schema: testSchema, data } = body;

    if (!testSchema || !data) {
      return json({ error: 'Missing schema or data in request body' }, 400);
    }

    const errors = validateSchema(data, testSchema);
    
    if (errors.length > 0) {
      return json({
        valid: false,
        errors: errors.map(e => ({
          field: e.field,
          message: e.message,
          value: e.value
        }))
      });
    }

    return json({ valid: true, message: 'Data is valid according to schema' });
  } catch (error) {
    return json({ error: 'Invalid request format' }, 400);
  }
});

console.log(`
🚀 Schema Validation Demo Server Started!

Test the validation features:

1. Valid User Registration:
   curl -X POST http://localhost:3001/users \\
     -H "Content-Type: application/json" \\
     -d '{"name":"John Doe","email":"john@example.com","age":30,"preferences":{"newsletter":true,"theme":"dark"}}'

2. Invalid User (missing required fields):
   curl -X POST http://localhost:3001/users \\
     -H "Content-Type: application/json" \\
     -d '{"name":"John"}'

3. Product Search with Query Validation:
   curl "http://localhost:3001/products/search?q=laptop&category=electronics&minPrice=100&maxPrice=2000"

4. Invalid Search (invalid category):
   curl "http://localhost:3001/products/search?category=invalid&page=0"

5. Batch Operations:
   curl -X POST http://localhost:3001/batch \\
     -H "Content-Type: application/json" \\
     -d '{"updates":[{"id":1,"action":"update","data":{"name":"Updated","status":"active"}},{"id":2,"action":"delete"}]}'

6. Direct Schema Validation:
   curl -X POST http://localhost:3001/validate \\
     -H "Content-Type: application/json" \\
     -d '{"schema":{"type":"string","format":"email"},"data":"test@example.com"}'

Visit http://localhost:3001 for more examples!
`);
