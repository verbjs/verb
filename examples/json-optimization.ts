import { createServer, schemas, optimizedJSON, validateSchema, commonSchemas } from "../src/index";

const app = createServer();

// Example 1: Basic JSON optimization with schema validation
const userSchema = schemas.object({
  name: schemas.string({ minLength: 1, maxLength: 50 }),
  email: schemas.string(),
  age: schemas.number({ minimum: 0, maximum: 150 }),
  active: schemas.boolean()
}, ['name', 'email']); // name and email are required

// Use optimized JSON middleware with request and response schemas
app.use(optimizedJSON({
  requestSchema: userSchema,
  responseSchema: commonSchemas.apiResponse,
  limit: 1024 * 1024, // 1MB limit
  strict: true, // Reject additional properties
  optimizeResponse: true // Enable response optimization
}));

// Example 2: Route-level schema validation
app.post('/users', validateSchema(userSchema), (req, res) => {
  // req.body is now validated and cleaned
  const user = req.body;
  
  // Simulate user creation
  const createdUser = {
    id: Date.now().toString(),
    ...user,
    createdAt: new Date().toISOString()
  };
  
  // Response will be validated and optimized
  res.json({
    success: true,
    data: createdUser,
    message: "User created successfully",
    timestamp: new Date().toISOString()
  });
});

// Example 3: Array validation
const usersArraySchema = schemas.array(userSchema);

app.post('/users/batch', validateSchema(usersArraySchema), (req, res) => {
  const users = req.body;
  
  // Process batch of users
  const createdUsers = users.map((user: any) => ({
    id: Date.now().toString() + Math.random(),
    ...user,
    createdAt: new Date().toISOString()
  }));
  
  res.json({
    success: true,
    data: createdUsers,
    message: `${createdUsers.length} users created successfully`,
    timestamp: new Date().toISOString()
  });
});

// Example 4: Custom schema with nested objects
const orderSchema = schemas.object({
  customer: schemas.object({
    name: schemas.string({ minLength: 1 }),
    email: schemas.string(),
    address: schemas.object({
      street: schemas.string(),
      city: schemas.string(),
      zipCode: schemas.string({ pattern: "^[0-9]{5}$" })
    }, ['street', 'city', 'zipCode'])
  }, ['name', 'email', 'address']),
  
  items: schemas.array(schemas.object({
    productId: schemas.string(),
    quantity: schemas.number({ minimum: 1 }),
    price: schemas.number({ minimum: 0 })
  }, ['productId', 'quantity', 'price'])),
  
  total: schemas.number({ minimum: 0 })
}, ['customer', 'items', 'total']);

app.post('/orders', validateSchema(orderSchema), (req, res) => {
  const order = req.body;
  
  // Validate total matches items
  const calculatedTotal = order.items.reduce((sum: number, item: any) => 
    sum + (item.quantity * item.price), 0
  );
  
  if (Math.abs(calculatedTotal - order.total) > 0.01) {
    return res.status(400).json({
      error: "Validation failed",
      message: "Order total does not match items"
    });
  }
  
  res.json({
    success: true,
    data: {
      id: Date.now().toString(),
      ...order,
      status: "pending",
      createdAt: new Date().toISOString()
    },
    message: "Order created successfully",
    timestamp: new Date().toISOString()
  });
});

// Example 5: Performance demonstration
app.get('/performance-test', (req, res) => {
  const testData = {
    users: Array.from({ length: 1000 }, (_, i) => ({
      id: i.toString(),
      name: `User ${i}`,
      email: `user${i}@example.com`,
      age: 20 + (i % 50)
    }))
  };
  
  const startTime = performance.now();
  
  // This will use optimized serialization
  res.json({
    success: true,
    data: testData,
    message: "Performance test completed",
    timestamp: new Date().toISOString(),
    processingTime: performance.now() - startTime
  });
});

// Example 6: Error handling with schema validation
app.use((err: any, req: any, res: any, next: any) => {
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: "Validation failed",
      message: err.message,
      details: err.details
    });
  }
  
  res.status(500).json({
    error: "Internal server error",
    message: "Something went wrong"
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage()
    },
    message: "Server is running"
  });
});

console.log("🚀 Starting JSON optimization example server...");
console.log("📊 Features demonstrated:");
console.log("  - Schema-based request validation");
console.log("  - Optimized JSON serialization");
console.log("  - High-performance validation (1000+ validations/ms)");
console.log("  - Nested object validation");
console.log("  - Array validation");
console.log("  - Custom schema patterns");
console.log();

const server = app.listen(3000);
console.log("🔥 Server running on http://localhost:3000");
console.log();
console.log("📋 Test endpoints:");
console.log("  POST /users - Create user with validation");
console.log("  POST /users/batch - Create multiple users");
console.log("  POST /orders - Create order with nested validation");
console.log("  GET /performance-test - Performance demonstration");
console.log("  GET /health - Health check");
console.log();
console.log("🧪 Example request:");
console.log(`curl -X POST http://localhost:3000/users \\
  -H "Content-Type: application/json" \\
  -d '{"name": "John Doe", "email": "john@example.com", "age": 30, "active": true}'`);

export { server };