import {
  createServer,
  json,
  initLogger,
  requestLogger,
  performanceLogger,
  errorLogger,
  createDevelopmentLogger,
  createProductionLogger,
  Logger,
  LogLevel,
  type LoggerOptions
} from "../src/index.ts";

// Initialize different logger configurations
const devLogger = createDevelopmentLogger();
const prodLogger = createProductionLogger();

// Custom logger with file output
const fileLogger = new Logger({
  level: LogLevel.INFO,
  destination: 'file',
  filePath: './app.log',
  context: {
    service: 'verb-logging-demo',
    version: '1.0.0',
    environment: 'demo'
  }
});

const app = createServer({ port: 3004 });

// Apply logging middleware
app.use(requestLogger({
  level: LogLevel.INFO,
  prettyPrint: true,
  context: {
    service: 'verb-demo',
    environment: 'development'
  }
}));

app.use(performanceLogger(100)); // Log requests slower than 100ms
app.use(errorLogger());

// Root endpoint with logging information
app.get('/', () => {
  devLogger.info('Root endpoint accessed', { 
    feature: 'structured-logging-demo',
    timestamp: new Date().toISOString()
  });

  return json({
    message: 'Structured Logging Demo',
    features: [
      'Request correlation IDs',
      'Structured JSON logging',
      'Multiple log levels (TRACE, DEBUG, INFO, WARN, ERROR, FATAL)',
      'Pretty printing for development',
      'File output support',
      'Performance monitoring',
      'Error tracking'
    ],
    endpoints: {
      'GET /log-levels': 'Demonstrate different log levels',
      'POST /user-action': 'Simulate user action with logging',
      'GET /performance': 'Performance logging demo',
      'GET /error-demo': 'Error logging demonstration',
      'GET /correlation': 'Correlation ID tracking',
      'POST /business-logic': 'Business logic with structured logging',
      'GET /metrics': 'Logging metrics and statistics'
    },
    loggerTypes: {
      development: 'Pretty printed, verbose logging',
      production: 'JSON format, optimized for log aggregation',
      file: 'Persistent logging to files'
    }
  });
});

// Demonstrate different log levels
app.get('/log-levels', () => {
  const correlationId = Math.random().toString(36).substring(7);
  const logger = devLogger.child(correlationId);

  logger.trace('This is a TRACE level message', { detail: 'lowest level, very verbose' });
  logger.debug('This is a DEBUG level message', { detail: 'development information' });
  logger.info('This is an INFO level message', { detail: 'general information' });
  logger.warn('This is a WARN level message', { detail: 'something to be aware of' });
  logger.error('This is an ERROR level message', new Error('Demo error'), { detail: 'error occurred' });
  logger.fatal('This is a FATAL level message', new Error('Demo fatal error'), { detail: 'critical system error' });

  return json({
    message: 'Log levels demonstration',
    note: 'Check your console/logs to see different log levels',
    correlationId,
    levels: {
      TRACE: 'Most verbose - usually disabled in production',
      DEBUG: 'Debugging information - development only',
      INFO: 'General information - default production level',
      WARN: 'Warning conditions - potential issues',
      ERROR: 'Error conditions - actual errors',
      FATAL: 'Fatal errors - system unusable'
    },
    timestamp: new Date().toISOString()
  });
});

// Simulate user action with structured logging
app.post('/user-action', async (req) => {
  const correlationId = req.headers.get('x-correlation-id') || 
                        Math.random().toString(36).substring(7);
  const logger = devLogger.child(correlationId);

  try {
    const body = await req.json();
    const { userId, action, data } = body;

    logger.info('User action initiated', {
      userId,
      action,
      timestamp: new Date().toISOString(),
      requestSize: JSON.stringify(body).length
    });

    // Simulate business logic with logging
    if (!userId) {
      logger.warn('User action attempted without user ID', {
        action,
        source: 'user-action-endpoint'
      });
      return json({ error: 'User ID required' }, 400);
    }

    if (!action) {
      logger.error('Invalid action in user request', new Error('Action field missing'), {
        userId,
        received: body
      });
      return json({ error: 'Action required' }, 400);
    }

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, Math.random() * 200));

    logger.info('User action completed successfully', {
      userId,
      action,
      processingTime: Math.random() * 200,
      resultCode: 'success'
    });

    // Also log to file logger
    fileLogger.info('User action logged to file', {
      userId,
      action,
      correlationId,
      timestamp: new Date().toISOString()
    });

    return json({
      message: 'User action processed',
      correlationId,
      userId,
      action,
      status: 'success',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('User action failed', error instanceof Error ? error : new Error(String(error)), {
      correlationId,
      endpoint: 'user-action'
    });

    return json({ error: 'Failed to process user action' }, 500);
  }
});

// Performance logging demonstration
app.get('/performance', async () => {
  const correlationId = Math.random().toString(36).substring(7);
  const logger = devLogger.child(correlationId);
  
  logger.info('Performance test started', { testType: 'simulated-delay' });

  // Simulate different performance scenarios
  const delay = Math.random() * 500; // 0-500ms delay
  await new Promise(resolve => setTimeout(resolve, delay));

  if (delay > 300) {
    logger.warn('Slow operation detected', {
      actualDelay: delay,
      threshold: 300,
      recommendation: 'Consider optimization'
    });
  }

  logger.info('Performance test completed', {
    duration: delay,
    performance: delay > 300 ? 'slow' : 'normal'
  });

  return json({
    message: 'Performance logging demo',
    correlationId,
    simulatedDelay: delay,
    performance: delay > 300 ? 'slow' : 'normal',
    note: 'Check logs for performance warnings on slow requests',
    timestamp: new Date().toISOString()
  });
});

// Error logging demonstration
app.get('/error-demo', () => {
  const errorType = new URL(app.server.url + '/error-demo').searchParams.get('type') || 'handled';
  const correlationId = Math.random().toString(36).substring(7);
  const logger = devLogger.child(correlationId);

  switch (errorType) {
    case 'unhandled':
      logger.warn('About to trigger unhandled error for demo');
      throw new Error('This is an unhandled error for demonstration');

    case 'business':
      const businessError = new Error('Business logic validation failed');
      logger.error('Business logic error occurred', businessError, {
        errorType: 'business-validation',
        context: 'error-demo-endpoint'
      });
      
      return json({
        error: 'Business validation failed',
        correlationId,
        type: 'business-error',
        timestamp: new Date().toISOString()
      }, 422);

    case 'external':
      logger.error('External service error simulation', new Error('Service unavailable'), {
        service: 'external-api',
        retryable: true,
        errorCode: 'SERVICE_UNAVAILABLE'
      });
      
      return json({
        error: 'External service temporarily unavailable',
        correlationId,
        retryAfter: 30,
        timestamp: new Date().toISOString()
      }, 503);

    default:
      logger.info('Handled error demonstration', {
        errorType: 'demonstration',
        handled: true
      });
      
      return json({
        message: 'Error logging demonstration',
        correlationId,
        availableTypes: {
          handled: '?type=handled',
          business: '?type=business',
          external: '?type=external',
          unhandled: '?type=unhandled'
        },
        note: 'Try different error types to see various logging patterns',
        timestamp: new Date().toISOString()
      });
  }
});

// Correlation ID tracking demonstration
app.get('/correlation', (req) => {
  const correlationId = req.headers.get('x-correlation-id') || 
                        Math.random().toString(36).substring(7);
  const logger = devLogger.child(correlationId);

  logger.info('Correlation tracking demo started', {
    source: 'correlation-endpoint',
    hasProvidedId: !!req.headers.get('x-correlation-id')
  });

  // Simulate calling another service
  logger.debug('Calling external service', {
    service: 'user-service',
    operation: 'getUserProfile'
  });

  // Simulate service response
  setTimeout(() => {
    logger.debug('External service responded', {
      service: 'user-service',
      responseTime: '45ms',
      status: 'success'
    });
  }, 45);

  logger.info('Correlation tracking demo completed', {
    correlationId,
    processing: 'completed'
  });

  return json({
    message: 'Correlation ID tracking demonstration',
    correlationId,
    note: 'This correlation ID tracks the request through all log entries',
    instructions: {
      manual: 'Provide x-correlation-id header to use your own ID',
      automatic: 'If not provided, a correlation ID is automatically generated'
    },
    tracing: 'All log entries for this request will include the correlation ID',
    timestamp: new Date().toISOString()
  });
});

// Business logic with comprehensive logging
app.post('/business-logic', async (req) => {
  const correlationId = req.headers.get('x-correlation-id') || 
                        Math.random().toString(36).substring(7);
  const logger = devLogger.child(correlationId);

  const startTime = Date.now();
  
  try {
    const body = await req.json();
    const { operation, params } = body;

    logger.info('Business operation started', {
      operation,
      paramCount: params ? Object.keys(params).length : 0,
      startTime: new Date().toISOString()
    });

    // Validation phase
    if (!operation) {
      logger.warn('Business operation validation failed', {
        reason: 'missing-operation',
        received: body
      });
      return json({ error: 'Operation required' }, 400);
    }

    // Processing phase
    logger.debug('Processing business logic', {
      operation,
      phase: 'processing'
    });

    const result = {
      operation,
      status: 'completed',
      processedAt: new Date().toISOString(),
      data: params || {}
    };

    const processingTime = Date.now() - startTime;

    logger.info('Business operation completed', {
      operation,
      processingTime,
      resultSize: JSON.stringify(result).length,
      success: true
    });

    // Performance logging
    if (processingTime > 200) {
      logger.warn('Slow business operation detected', {
        operation,
        processingTime,
        threshold: 200,
        recommendation: 'Review operation efficiency'
      });
    }

    return json({
      message: 'Business logic completed',
      correlationId,
      result,
      performance: {
        processingTime,
        rating: processingTime > 200 ? 'slow' : 'normal'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    logger.error('Business operation failed', error instanceof Error ? error : new Error(String(error)), {
      processingTime,
      phase: 'execution',
      correlationId
    });

    return json({
      error: 'Business operation failed',
      correlationId,
      processingTime,
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// Logging metrics and statistics
app.get('/metrics', () => {
  const logger = devLogger.child('metrics-' + Date.now());

  logger.info('Logging metrics requested', {
    endpoint: 'metrics',
    requestTime: new Date().toISOString()
  });

  // Mock metrics (in production, these would come from actual log aggregation)
  const mockMetrics = {
    totalLogs: Math.floor(Math.random() * 10000),
    logsByLevel: {
      TRACE: Math.floor(Math.random() * 100),
      DEBUG: Math.floor(Math.random() * 500),
      INFO: Math.floor(Math.random() * 2000),
      WARN: Math.floor(Math.random() * 100),
      ERROR: Math.floor(Math.random() * 50),
      FATAL: Math.floor(Math.random() * 5)
    },
    correlationStats: {
      uniqueCorrelationIds: Math.floor(Math.random() * 1000),
      averageRequestsPerCorrelation: 2.3,
      longestTrace: '12 log entries'
    },
    performance: {
      averageRequestTime: '45ms',
      slowRequests: Math.floor(Math.random() * 20),
      fastRequests: Math.floor(Math.random() * 980)
    }
  };

  return json({
    message: 'Logging metrics and statistics',
    note: 'In production, integrate with log aggregation tools like ELK, Splunk, or DataDog',
    metrics: mockMetrics,
    recommendations: [
      'Set up log aggregation for production monitoring',
      'Create dashboards for key metrics',
      'Set up alerts for error rate thresholds',
      'Use correlation IDs for distributed tracing',
      'Monitor performance metrics regularly'
    ],
    logAggregationTools: [
      'ELK Stack (Elasticsearch, Logstash, Kibana)',
      'Splunk',
      'DataDog',
      'New Relic',
      'CloudWatch (AWS)',
      'Google Cloud Logging'
    ],
    timestamp: new Date().toISOString()
  });
});

console.log(`
📊 Structured Logging Demo Server Started!

Test the logging features:

1. Basic Logging:
   curl http://localhost:3004/

2. Log Levels:
   curl http://localhost:3004/log-levels

3. User Action Logging:
   curl -X POST http://localhost:3004/user-action \\
     -H "Content-Type: application/json" \\
     -H "x-correlation-id: user-123" \\
     -d '{"userId":"user123","action":"profile_update","data":{"name":"John"}}'

4. Performance Logging:
   curl http://localhost:3004/performance

5. Error Logging:
   curl "http://localhost:3004/error-demo?type=business"
   curl "http://localhost:3004/error-demo?type=external"

6. Correlation Tracking:
   curl -H "x-correlation-id: my-trace-123" http://localhost:3004/correlation

7. Business Logic Logging:
   curl -X POST http://localhost:3004/business-logic \\
     -H "Content-Type: application/json" \\
     -d '{"operation":"user_registration","params":{"email":"test@example.com"}}'

8. Logging Metrics:
   curl http://localhost:3004/metrics

9. File Logging Test:
   curl -X POST http://localhost:3004/user-action \\
     -H "Content-Type: application/json" \\
     -d '{"userId":"file-test","action":"file_log_test"}'
   cat ./app.log

Visit http://localhost:3004 for detailed information!
Check your console and ./app.log for structured log output.
`);
