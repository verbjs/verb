import { createServer } from '../../src/index';
import { 
  HttpError, 
  BadRequestError, 
  UnauthorizedError, 
  NotFoundError, 
  defaultErrorHandler,
  asyncHandler,
  validateRequest,
  authenticationError
} from '../../src/errors';
import { 
  createErrorHandlerStack,
  errorLogger,
  jsonErrorHandler,
  corsErrorHandler
} from '../../src/errors/middleware';
import type { VerbRequest, VerbResponse, ErrorHandler } from '../../src/types';

const app = createServer();

// Example 1: Custom error handler
const customErrorHandler: ErrorHandler = async (err: Error, req: VerbRequest, res: VerbResponse, next: () => void) => {
  console.log('Custom error handler called:', err.message);
  
  // Handle specific error types
  if (err.name === 'CustomError') {
    res.status(400).json({
      error: {
        type: 'custom',
        message: err.message,
        timestamp: new Date().toISOString()
      }
    });
    return;
  }
  
  // Pass to next error handler
  next();
};

// Example 2: Comprehensive error handling setup
const errorHandlers = createErrorHandlerStack({
  enableLogging: true,
  enableCors: true,
  customHandlers: [customErrorHandler]
});

// Apply error handlers (in Express, this would be done with app.use)
// For demonstration, we'll use them in individual routes

// Example 3: Routes that demonstrate different error scenarios
app.get('/error/basic', (req: VerbRequest, res: VerbResponse) => {
  throw new Error('Basic error example');
});

app.get('/error/http', (req: VerbRequest, res: VerbResponse) => {
  throw new BadRequestError('This is a bad request');
});

app.get('/error/unauthorized', (req: VerbRequest, res: VerbResponse) => {
  throw new UnauthorizedError('Please login first');
});

app.get('/error/custom', (req: VerbRequest, res: VerbResponse) => {
  const error = new Error('Custom error handling');
  error.name = 'CustomError';
  throw error;
});

app.get('/error/async', asyncHandler(async (req: VerbRequest, res: VerbResponse) => {
  // Simulate async operation that fails
  await new Promise(resolve => setTimeout(resolve, 100));
  throw new Error('Async operation failed');
}));

app.get('/error/validation', (req: VerbRequest, res: VerbResponse) => {
  // Simulate validation error
  try {
    validateRequest(req, {
      body: true,
      requiredFields: ['name', 'email']
    });
  } catch (error) {
    throw error;
  }
});

app.get('/error/auth', (req: VerbRequest, res: VerbResponse) => {
  // Check for auth token
  const token = req.headers.get('authorization');
  if (!token) {
    throw authenticationError('Authorization header required');
  }
  
  if (token !== 'Bearer valid-token') {
    throw authenticationError('Invalid token');
  }
  
  res.json({ message: 'Authenticated successfully' });
});

// Example 4: Error boundary pattern
const errorBoundary = (handler: (req: VerbRequest, res: VerbResponse) => Promise<any>) => {
  return async (req: VerbRequest, res: VerbResponse) => {
    try {
      await handler(req, res);
    } catch (error) {
      console.error('Error caught by boundary:', error);
      
      // Apply error handler stack
      let errorHandled = false;
      let nextCalled = false;
      
      const next = () => {
        nextCalled = true;
      };
      
      for (const errorHandler of errorHandlers) {
        nextCalled = false;
        try {
          await errorHandler(error as Error, req, res, next);
          if (!nextCalled) {
            errorHandled = true;
            break;
          }
        } catch (handlerError) {
          console.error('Error in error handler:', handlerError);
        }
      }
      
      if (!errorHandled) {
        await defaultErrorHandler(error as Error, req, res, () => {});
      }
    }
  };
};

app.get('/error/boundary', errorBoundary(async (req: VerbRequest, res: VerbResponse) => {
  throw new Error('Error handled by boundary');
}));

// Example 5: Database error simulation
app.get('/error/database', (req: VerbRequest, res: VerbResponse) => {
  const error = new Error('Connection timeout');
  error.name = 'DatabaseError';
  throw error;
});

// Example 6: File upload error simulation
app.post('/error/upload', (req: VerbRequest, res: VerbResponse) => {
  const error = new HttpError(413, 'File too large');
  error.name = 'UploadError';
  throw error;
});

// Example 7: Rate limiting error
app.get('/error/ratelimit', (req: VerbRequest, res: VerbResponse) => {
  const error = new HttpError(429, 'Too many requests');
  error.name = 'TooManyRequestsError';
  throw error;
});

// Example 8: Successful routes for comparison
app.get('/success', (req: VerbRequest, res: VerbResponse) => {
  res.json({ 
    message: 'Success!',
    timestamp: new Date().toISOString()
  });
});

app.get('/success/async', asyncHandler(async (req: VerbRequest, res: VerbResponse) => {
  await new Promise(resolve => setTimeout(resolve, 100));
  res.json({ 
    message: 'Async success!',
    timestamp: new Date().toISOString()
  });
}));

// Example 9: Error testing utility
app.get('/error/test/:type', (req: VerbRequest, res: VerbResponse) => {
  const errorType = req.params?.type;
  
  switch (errorType) {
    case 'badrequest':
      throw new BadRequestError('Test bad request');
    case 'unauthorized':
      throw new UnauthorizedError('Test unauthorized');
    case 'notfound':
      throw new NotFoundError('Test not found');
    case 'internal':
      throw new Error('Test internal error');
    case 'http':
      throw new HttpError(422, 'Test HTTP error');
    default:
      res.json({ 
        message: 'Available error types: badrequest, unauthorized, notfound, internal, http',
        example: '/error/test/badrequest'
      });
  }
});

// Example 10: Health check with error monitoring
app.get('/health', (req: VerbRequest, res: VerbResponse) => {
  try {
    // Simulate health checks
    const checks = {
      database: Math.random() > 0.1, // 90% success rate
      cache: Math.random() > 0.05,   // 95% success rate
      external: Math.random() > 0.2  // 80% success rate
    };
    
    const healthy = Object.values(checks).every(check => check);
    
    if (!healthy) {
      throw new Error('Health check failed');
    }
    
    res.json({
      status: 'healthy',
      checks,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: (error as Error).message,
      timestamp: new Date().toISOString()
    });
  }
});

// Example 11: API documentation
app.get('/', (req: VerbRequest, res: VerbResponse) => {
  res.json({
    name: 'Error Handling Example API',
    version: '1.0.0',
    endpoints: {
      'GET /': 'This documentation',
      'GET /success': 'Successful response',
      'GET /success/async': 'Async successful response',
      'GET /health': 'Health check with error simulation',
      'GET /error/basic': 'Basic error example',
      'GET /error/http': 'HTTP error example (400)',
      'GET /error/unauthorized': 'Unauthorized error (401)',
      'GET /error/custom': 'Custom error handler example',
      'GET /error/async': 'Async error example',
      'GET /error/validation': 'Validation error example',
      'GET /error/auth': 'Authentication error (requires Authorization header)',
      'GET /error/boundary': 'Error boundary pattern example',
      'GET /error/database': 'Database error simulation',
      'POST /error/upload': 'File upload error simulation',
      'GET /error/ratelimit': 'Rate limiting error',
      'GET /error/test/:type': 'Test specific error types'
    },
    examples: {
      'Valid auth request': 'curl -H "Authorization: Bearer valid-token" http://localhost:3000/error/auth',
      'Invalid auth request': 'curl http://localhost:3000/error/auth',
      'Test bad request': 'curl http://localhost:3000/error/test/badrequest',
      'Test with CORS': 'curl -H "Origin: http://example.com" http://localhost:3000/error/http'
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

console.log(`🚀 Error handling example server running on http://localhost:${port}`);
console.log('\\nError handling features:');
console.log('✅ Custom error classes (HttpError, BadRequestError, etc.)');
console.log('✅ Error handler middleware with (err, req, res, next) signature');
console.log('✅ Custom 404 and 500 error pages');
console.log('✅ Error propagation through middleware stack');
console.log('✅ Async error handling with asyncHandler');
console.log('✅ Validation error handling');
console.log('✅ Authentication/authorization error helpers');
console.log('✅ Error logging and monitoring');
console.log('✅ CORS error handling');
console.log('✅ Error boundary pattern');
console.log('\\nTesting suggestions:');
console.log('1. Visit http://localhost:3000 for API documentation');
console.log('2. Try different error endpoints to see error handling');
console.log('3. Check browser dev tools for error responses');
console.log('4. Test with different Accept headers (application/json vs text/html)');
console.log('5. Try the auth endpoint with and without Authorization header');
console.log('\\nExample commands:');
console.log('curl http://localhost:3000/error/basic');
console.log('curl -H "Accept: application/json" http://localhost:3000/error/unauthorized');
console.log('curl -H "Authorization: Bearer valid-token" http://localhost:3000/error/auth');
console.log('curl -X POST http://localhost:3000/error/upload');