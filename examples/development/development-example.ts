import { createServer } from '../../src/index';
import { 
  enableRouteDebugging,
  enablePerformanceMonitoring,
  registerHealthCheck,
  registerBuiltInHealthChecks,
  createHealthCheckEndpoints,
  createDevelopmentMiddleware,
  getPerformanceMetrics,
  getRouteDebugLogs,
  formatUptime,
  formatMemoryUsage,
  getSystemInfo
} from '../../src/development';

const app = createServer();

// Enable development features
console.log('🚀 Starting development server with monitoring...');

// Method 1: Use the all-in-one development middleware
app.use(createDevelopmentMiddleware({
  enableDebugging: true,
  enablePerformanceMonitoring: true,
  enableHealthChecks: true
}));

// Method 2: Enable features individually (alternative approach)
// enableRouteDebugging(true);
// enablePerformanceMonitoring(true);
// registerBuiltInHealthChecks();

// Register custom health checks
registerHealthCheck('database', async () => {
  // Simulate database connection check
  const isConnected = Math.random() > 0.1; // 90% success rate
  
  if (!isConnected) {
    return {
      status: 'fail',
      message: 'Database connection failed'
    };
  }
  
  return {
    status: 'pass',
    message: 'Database connected successfully'
  };
});

registerHealthCheck('external-api', async () => {
  // Simulate external API check
  const start = Date.now();
  
  try {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
    
    const responseTime = Date.now() - start;
    
    if (responseTime > 80) {
      return {
        status: 'warn',
        message: `External API slow: ${responseTime}ms`,
        responseTime
      };
    }
    
    return {
      status: 'pass',
      message: `External API healthy: ${responseTime}ms`,
      responseTime
    };
  } catch (error) {
    return {
      status: 'fail',
      message: 'External API unavailable'
    };
  }
});

// Create health check endpoints
createHealthCheckEndpoints(app);

// Sample application routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'Development server is running!',
    timestamp: new Date().toISOString(),
    uptime: formatUptime(process.uptime() * 1000)
  });
});

app.get('/users/:id', (req, res) => {
  const { id } = req.params;
  
  // Simulate some processing time
  const processingTime = Math.random() * 200;
  
  setTimeout(() => {
    if (id === '999') {
      res.status(404).json({ error: 'User not found' });
    } else {
      res.json({
        id,
        name: `User ${id}`,
        email: `user${id}@example.com`,
        processingTime: `${processingTime.toFixed(2)}ms`
      });
    }
  }, processingTime);
});

app.post('/users', (req, res) => {
  // Simulate validation error
  if (Math.random() > 0.8) {
    res.status(400).json({ error: 'Invalid user data' });
    return;
  }
  
  // Simulate server error
  if (Math.random() > 0.9) {
    res.status(500).json({ error: 'Internal server error' });
    return;
  }
  
  res.status(201).json({
    id: Math.floor(Math.random() * 1000),
    name: 'New User',
    created: new Date().toISOString()
  });
});

app.get('/slow', (req, res) => {
  // Intentionally slow endpoint for testing
  setTimeout(() => {
    res.json({ 
      message: 'This endpoint is intentionally slow',
      delay: '2000ms'
    });
  }, 2000);
});

app.get('/memory-test', (req, res) => {
  // Memory intensive operation for testing
  const largeArray = new Array(100000).fill('test data');
  
  res.json({
    message: 'Memory test complete',
    arraySize: largeArray.length,
    memoryUsage: {
      heapUsed: formatMemoryUsage(process.memoryUsage().heapUsed),
      heapTotal: formatMemoryUsage(process.memoryUsage().heapTotal)
    }
  });
});

app.get('/stats', (req, res) => {
  const metrics = getPerformanceMetrics();
  const debugLogs = getRouteDebugLogs(10);
  const systemInfo = getSystemInfo();
  
  res.json({
    performance: metrics,
    recentRequests: debugLogs,
    system: systemInfo
  });
});

// Error simulation endpoint
app.get('/error', (req, res) => {
  throw new Error('Simulated error for testing');
});

// Start the server
const server = app.listen(3000);

console.log('🌐 Server running on http://localhost:3000');
console.log('');
console.log('🔍 Development endpoints:');
console.log('  GET  /health          - Basic health check');
console.log('  GET  /health/detailed - Detailed health check');
console.log('  GET  /health/performance - Performance metrics');
console.log('  GET  /health/debug    - Debug logs');
console.log('  GET  /stats           - Application statistics');
console.log('');
console.log('📊 Test endpoints:');
console.log('  GET  /                - Welcome message');
console.log('  GET  /users/:id       - Get user (try /users/999 for 404)');
console.log('  POST /users           - Create user (random errors)');
console.log('  GET  /slow            - Slow endpoint (2s delay)');
console.log('  GET  /memory-test     - Memory intensive operation');
console.log('  GET  /error           - Simulated error');
console.log('');
console.log('💡 Features enabled:');
console.log('  ✅ Route debugging - See detailed request logs');
console.log('  ✅ Performance monitoring - Track response times & memory');
console.log('  ✅ Health checks - Monitor application health');
console.log('');

// Example of monitoring in action
setInterval(() => {
  const metrics = getPerformanceMetrics();
  if (metrics.requestCount > 0) {
    console.log('📈 Performance Update:');
    console.log(`   Requests: ${metrics.requestCount}`);
    console.log(`   Avg Response Time: ${metrics.averageResponseTime.toFixed(2)}ms`);
    console.log(`   Error Rate: ${((metrics.errorCount / metrics.requestCount) * 100).toFixed(1)}%`);
    console.log(`   Memory Peak: ${formatMemoryUsage(metrics.memoryPeak)}`);
    console.log(`   Uptime: ${formatUptime(metrics.uptime)}`);
    console.log('');
  }
}, 30000); // Every 30 seconds

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  
  const finalMetrics = getPerformanceMetrics();
  console.log('📊 Final Statistics:');
  console.log(`   Total Requests: ${finalMetrics.requestCount}`);
  console.log(`   Average Response Time: ${finalMetrics.averageResponseTime.toFixed(2)}ms`);
  console.log(`   Total Errors: ${finalMetrics.errorCount}`);
  console.log(`   Uptime: ${formatUptime(finalMetrics.uptime)}`);
  
  server.stop();
  process.exit(0);
});

// Example of programmatic monitoring
async function monitoringExample() {
  // Wait a bit for some requests to come in
  await new Promise(resolve => setTimeout(resolve, 60000));
  
  // Get performance metrics
  const metrics = getPerformanceMetrics();
  console.log('📊 Performance Metrics:', metrics);
  
  // Get recent debug logs
  const debugLogs = getRouteDebugLogs(5);
  console.log('🔍 Recent Debug Logs:', debugLogs);
  
  // Get system info
  const systemInfo = getSystemInfo();
  console.log('💻 System Info:', systemInfo);
}

// Run monitoring example (commented out to avoid blocking)
// monitoringExample();