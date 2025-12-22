import { performance } from "node:perf_hooks";
import type { Middleware, ServerInstance, VerbRequest, VerbResponse } from "../types";

// Development feature types
export type RouteDebugInfo = {
  path: string;
  method: string;
  timestamp: number;
  matchTime: number;
  middlewareTime: number;
  handlerTime: number;
  totalTime: number;
  matched: boolean;
  params: Record<string, string>;
  query: Record<string, string>;
  statusCode: number;
  responseSize: number;
  memoryUsage: NodeJS.MemoryUsage;
};

export type PerformanceMetrics = {
  requestCount: number;
  averageResponseTime: number;
  slowestRequest: RouteDebugInfo | null;
  fastestRequest: RouteDebugInfo | null;
  errorCount: number;
  memoryPeak: number;
  uptime: number;
};

export type HealthCheckResult = {
  status: "healthy" | "unhealthy" | "degraded";
  timestamp: number;
  uptime: number;
  memory: NodeJS.MemoryUsage;
  checks: Record<
    string,
    {
      status: "pass" | "fail" | "warn";
      message: string;
      responseTime?: number;
    }
  >;
  metadata?: Record<string, any>;
};

export type HealthCheckFunction = () => Promise<{
  status: "pass" | "fail" | "warn";
  message: string;
  responseTime?: number;
}>;

// Global storage for development features
const routeDebugLogs: RouteDebugInfo[] = [];
const performanceMetrics: PerformanceMetrics = {
  requestCount: 0,
  averageResponseTime: 0,
  slowestRequest: null,
  fastestRequest: null,
  errorCount: 0,
  memoryPeak: 0,
  uptime: Date.now(),
};

const healthChecks = new Map<string, HealthCheckFunction>();
let debuggingEnabled = false;
let performanceMonitoringEnabled = false;

// Route debugging functionality
export const enableRouteDebugging = (enabled: boolean = true): void => {
  debuggingEnabled = enabled;
  if (enabled) {
    console.log("🔍 Route debugging enabled");
  } else {
    console.log("🔍 Route debugging disabled");
  }
};

export const isRouteDebuggingEnabled = (): boolean => debuggingEnabled;

export const clearRouteDebugLogs = (): void => {
  routeDebugLogs.length = 0;
  console.log("🗑️ Route debug logs cleared");
};

export const getRouteDebugLogs = (limit?: number): RouteDebugInfo[] => {
  return limit ? routeDebugLogs.slice(-limit) : [...routeDebugLogs];
};

export const logRouteDebug = (debugInfo: RouteDebugInfo): void => {
  if (!debuggingEnabled) {
    return;
  }

  routeDebugLogs.push(debugInfo);

  // Keep only last 1000 logs to prevent memory issues
  if (routeDebugLogs.length > 1000) {
    routeDebugLogs.shift();
  }

  // Console logging with colors
  const statusColor =
    debugInfo.statusCode >= 400
      ? "\x1b[31m"
      : debugInfo.statusCode >= 300
        ? "\x1b[33m"
        : "\x1b[32m";
  const methodColor =
    debugInfo.method === "GET"
      ? "\x1b[32m"
      : debugInfo.method === "POST"
        ? "\x1b[34m"
        : debugInfo.method === "PUT"
          ? "\x1b[35m"
          : debugInfo.method === "DELETE"
            ? "\x1b[31m"
            : "\x1b[36m";

  console.log(
    `🔍 ${methodColor}${debugInfo.method}\x1b[0m ${debugInfo.path} ` +
      `${statusColor}${debugInfo.statusCode}\x1b[0m ` +
      `${debugInfo.totalTime.toFixed(2)}ms ` +
      `${debugInfo.matched ? "✅" : "❌"} ` +
      `${debugInfo.responseSize}B ` +
      `(${Math.round(debugInfo.memoryUsage.heapUsed / 1024 / 1024)}MB)`,
  );

  if (Object.keys(debugInfo.params).length > 0) {
    console.log(`   📍 Params: ${JSON.stringify(debugInfo.params)}`);
  }

  if (Object.keys(debugInfo.query).length > 0) {
    console.log(`   🔍 Query: ${JSON.stringify(debugInfo.query)}`);
  }

  if (debugInfo.totalTime > 100) {
    console.log(`   ⚠️  Slow request detected: ${debugInfo.totalTime.toFixed(2)}ms`);
  }
};

// Route debugging middleware
export const createRouteDebugMiddleware = (): Middleware => {
  return async (req: VerbRequest, res: VerbResponse, next: () => void) => {
    if (!debuggingEnabled) {
      next();
      return;
    }

    const startTime = performance.now();
    const _startMemory = process.memoryUsage();

    // Track middleware execution time
    const middlewareStart = performance.now();
    next();
    const middlewareTime = performance.now() - middlewareStart;

    // Capture original response methods to track handler time
    const originalSend = res.send;
    const originalJson = res.json;
    const originalEnd = res.end;

    const handlerStartTime = performance.now();
    let responseSize = 0;
    let statusCode = 200;

    const wrapResponse = (originalMethod: any) => {
      return function (this: any, ...args: any[]) {
        const handlerTime = performance.now() - handlerStartTime;
        const totalTime = performance.now() - startTime;
        const endMemory = process.memoryUsage();

        // Calculate response size
        if (args[0]) {
          responseSize = Buffer.byteLength(
            typeof args[0] === "string" ? args[0] : JSON.stringify(args[0]),
          );
        }

        // Get status code
        statusCode = (res as any).statusCode || 200;

        const debugInfo: RouteDebugInfo = {
          path: req.path || req.url,
          method: req.method as string,
          timestamp: Date.now(),
          matchTime: middlewareTime,
          middlewareTime: middlewareTime,
          handlerTime: handlerTime,
          totalTime: totalTime,
          matched: true,
          params: req.params || {},
          query: req.query || {},
          statusCode: statusCode,
          responseSize: responseSize,
          memoryUsage: endMemory,
        };

        logRouteDebug(debugInfo);
        updatePerformanceMetrics(debugInfo);

        return originalMethod.apply(this, args);
      };
    };

    res.send = wrapResponse(originalSend);
    res.json = wrapResponse(originalJson);
    res.end = wrapResponse(originalEnd);
  };
};

// Performance monitoring functionality
export const enablePerformanceMonitoring = (enabled: boolean = true): void => {
  performanceMonitoringEnabled = enabled;
  if (enabled) {
    console.log("📊 Performance monitoring enabled");

    // Start monitoring interval
    setInterval(() => {
      const memUsage = process.memoryUsage();
      if (memUsage.heapUsed > performanceMetrics.memoryPeak) {
        performanceMetrics.memoryPeak = memUsage.heapUsed;
      }
    }, 5000);
  } else {
    console.log("📊 Performance monitoring disabled");
  }
};

export const isPerformanceMonitoringEnabled = (): boolean => performanceMonitoringEnabled;

export const updatePerformanceMetrics = (debugInfo: RouteDebugInfo): void => {
  if (!performanceMonitoringEnabled) {
    return;
  }

  performanceMetrics.requestCount++;

  // Update average response time
  const oldAvg = performanceMetrics.averageResponseTime;
  performanceMetrics.averageResponseTime =
    (oldAvg * (performanceMetrics.requestCount - 1) + debugInfo.totalTime) /
    performanceMetrics.requestCount;

  // Update slowest request
  if (
    !performanceMetrics.slowestRequest ||
    debugInfo.totalTime > performanceMetrics.slowestRequest.totalTime
  ) {
    performanceMetrics.slowestRequest = debugInfo;
  }

  // Update fastest request
  if (
    !performanceMetrics.fastestRequest ||
    debugInfo.totalTime < performanceMetrics.fastestRequest.totalTime
  ) {
    performanceMetrics.fastestRequest = debugInfo;
  }

  // Update error count
  if (debugInfo.statusCode >= 400) {
    performanceMetrics.errorCount++;
  }

  // Update memory peak
  if (debugInfo.memoryUsage.heapUsed > performanceMetrics.memoryPeak) {
    performanceMetrics.memoryPeak = debugInfo.memoryUsage.heapUsed;
  }
};

export const getPerformanceMetrics = (): PerformanceMetrics => {
  return {
    ...performanceMetrics,
    uptime: performanceMetrics.uptime > 0 ? Date.now() - performanceMetrics.uptime : 0,
  };
};

export const resetPerformanceMetrics = (): void => {
  performanceMetrics.requestCount = 0;
  performanceMetrics.averageResponseTime = 0;
  performanceMetrics.slowestRequest = null;
  performanceMetrics.fastestRequest = null;
  performanceMetrics.errorCount = 0;
  performanceMetrics.memoryPeak = 0;
  performanceMetrics.uptime = Date.now();

  console.log("📊 Performance metrics reset");
};

// Performance monitoring middleware
export const createPerformanceMonitoringMiddleware = (): Middleware => {
  return async (req: VerbRequest, _res: VerbResponse, next: () => void) => {
    if (!performanceMonitoringEnabled) {
      next();
      return;
    }

    const startTime = performance.now();
    const startMemory = process.memoryUsage();

    // Add performance data to request
    (req as any).performanceStart = startTime;
    (req as any).memoryStart = startMemory;

    next();
  };
};

// Health check functionality
export const registerHealthCheck = (name: string, check: HealthCheckFunction): void => {
  healthChecks.set(name, check);
  console.log(`🏥 Health check registered: ${name}`);
};

export const unregisterHealthCheck = (name: string): boolean => {
  const removed = healthChecks.delete(name);
  if (removed) {
    console.log(`🏥 Health check unregistered: ${name}`);
  }
  return removed;
};

export const getRegisteredHealthChecks = (): string[] => {
  return Array.from(healthChecks.keys());
};

export const runHealthChecks = async (): Promise<HealthCheckResult> => {
  const startTime = performance.now();
  const memoryUsage = process.memoryUsage();
  const checks: Record<string, any> = {};

  let overallStatus: "healthy" | "unhealthy" | "degraded" = "healthy";

  // Run all registered health checks
  const checkPromises = Array.from(healthChecks.entries()).map(async ([name, check]) => {
    const checkStart = performance.now();
    try {
      const result = await check();
      const checkTime = performance.now() - checkStart;

      checks[name] = {
        ...result,
        responseTime: checkTime,
      };

      if (result.status === "fail") {
        overallStatus = "unhealthy";
      } else if (result.status === "warn" && overallStatus === "healthy") {
        overallStatus = "degraded";
      }
    } catch (error) {
      const checkTime = performance.now() - checkStart;
      checks[name] = {
        status: "fail",
        message: error instanceof Error ? error.message : "Unknown error",
        responseTime: checkTime,
      };
      overallStatus = "unhealthy";
    }
  });

  await Promise.all(checkPromises);

  const totalTime = performance.now() - startTime;

  return {
    status: overallStatus,
    timestamp: Date.now(),
    uptime: Date.now() - performanceMetrics.uptime,
    memory: memoryUsage,
    checks,
    metadata: {
      totalCheckTime: totalTime,
      checksCount: healthChecks.size,
      performanceMetrics: performanceMonitoringEnabled ? getPerformanceMetrics() : null,
    },
  };
};

// Built-in health checks
export const registerBuiltInHealthChecks = (): void => {
  // Basic health check
  registerHealthCheck("basic", async () => {
    return {
      status: "pass",
      message: "Application is running",
    };
  });

  // Memory health check
  registerHealthCheck("memory", async () => {
    const memUsage = process.memoryUsage();
    const memoryUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

    if (memoryUsagePercent > 90) {
      return {
        status: "fail",
        message: `Memory usage critical: ${memoryUsagePercent.toFixed(1)}%`,
      };
    } else if (memoryUsagePercent > 75) {
      return {
        status: "warn",
        message: `Memory usage high: ${memoryUsagePercent.toFixed(1)}%`,
      };
    }

    return {
      status: "pass",
      message: `Memory usage normal: ${memoryUsagePercent.toFixed(1)}%`,
    };
  });

  // Performance health check
  registerHealthCheck("performance", async () => {
    if (!performanceMonitoringEnabled) {
      return {
        status: "warn",
        message: "Performance monitoring disabled",
      };
    }

    const metrics = getPerformanceMetrics();

    if (metrics.averageResponseTime > 1000) {
      return {
        status: "fail",
        message: `Average response time too high: ${metrics.averageResponseTime.toFixed(2)}ms`,
      };
    } else if (metrics.averageResponseTime > 500) {
      return {
        status: "warn",
        message: `Average response time elevated: ${metrics.averageResponseTime.toFixed(2)}ms`,
      };
    }

    return {
      status: "pass",
      message: `Performance normal: ${metrics.averageResponseTime.toFixed(2)}ms avg`,
    };
  });

  // Error rate health check
  registerHealthCheck("error-rate", async () => {
    if (!performanceMonitoringEnabled) {
      return {
        status: "warn",
        message: "Performance monitoring disabled",
      };
    }

    const metrics = getPerformanceMetrics();
    const errorRate =
      metrics.requestCount > 0 ? (metrics.errorCount / metrics.requestCount) * 100 : 0;

    if (errorRate > 10) {
      return {
        status: "fail",
        message: `Error rate too high: ${errorRate.toFixed(1)}%`,
      };
    } else if (errorRate > 5) {
      return {
        status: "warn",
        message: `Error rate elevated: ${errorRate.toFixed(1)}%`,
      };
    }

    return {
      status: "pass",
      message: `Error rate normal: ${errorRate.toFixed(1)}%`,
    };
  });
};

// Health check endpoints
export const createHealthCheckEndpoints = (app: ServerInstance): void => {
  // Basic health endpoint
  app.get("/health", async (_req, res) => {
    try {
      const result = await runHealthChecks();
      const statusCode =
        result.status === "healthy" ? 200 : result.status === "degraded" ? 200 : 503;

      res.status(statusCode).json(result);
    } catch (error) {
      res.status(500).json({
        status: "unhealthy",
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Detailed health endpoint
  app.get("/health/detailed", async (_req, res) => {
    try {
      const result = await runHealthChecks();
      const statusCode =
        result.status === "healthy" ? 200 : result.status === "degraded" ? 200 : 503;

      res.status(statusCode).json({
        ...result,
        debug: debuggingEnabled
          ? {
              recentLogs: getRouteDebugLogs(10),
              debugLogsCount: routeDebugLogs.length,
            }
          : null,
      });
    } catch (error) {
      res.status(500).json({
        status: "unhealthy",
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Performance metrics endpoint
  app.get("/health/performance", async (_req, res) => {
    if (!performanceMonitoringEnabled) {
      res.status(503).json({
        error: "Performance monitoring is disabled",
      });
      return;
    }

    const metrics = getPerformanceMetrics();
    res.json(metrics);
  });

  // Debug logs endpoint
  app.get("/health/debug", async (req, res) => {
    if (!debuggingEnabled) {
      res.status(503).json({
        error: "Route debugging is disabled",
      });
      return;
    }

    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    const logs = getRouteDebugLogs(limit);

    res.json({
      enabled: debuggingEnabled,
      totalLogs: routeDebugLogs.length,
      logs: logs,
    });
  });
};

// Development middleware factory
export const createDevelopmentMiddleware = (
  options: {
    enableDebugging?: boolean;
    enablePerformanceMonitoring?: boolean;
    enableHealthChecks?: boolean;
  } = {},
): Middleware => {
  const {
    enableDebugging: shouldEnableDebugging = true,
    enablePerformanceMonitoring: shouldEnablePerformanceMonitoring = true,
    enableHealthChecks: shouldEnableHealthChecks = true,
  } = options;

  if (shouldEnableDebugging) {
    enableRouteDebugging(true);
  }

  if (shouldEnablePerformanceMonitoring) {
    enablePerformanceMonitoring(true);
  }

  if (shouldEnableHealthChecks) {
    registerBuiltInHealthChecks();
  }

  return async (req: VerbRequest, res: VerbResponse, next: () => void) => {
    const debugMiddleware = createRouteDebugMiddleware();
    const performanceMiddleware = createPerformanceMonitoringMiddleware();

    await debugMiddleware(req, res, () => {
      performanceMiddleware(req, res, next);
    });
  };
};

// Utility functions
export const formatMemoryUsage = (bytes: number): string => {
  const mb = bytes / 1024 / 1024;
  return `${mb.toFixed(2)} MB`;
};

export const formatUptime = (ms: number): string => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
};

export const getSystemInfo = () => {
  const memUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();

  return {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    uptime: formatUptime(process.uptime() * 1000),
    memory: {
      total: formatMemoryUsage(memUsage.heapTotal),
      used: formatMemoryUsage(memUsage.heapUsed),
      external: formatMemoryUsage(memUsage.external),
      rss: formatMemoryUsage(memUsage.rss),
    },
    cpu: {
      user: cpuUsage.user,
      system: cpuUsage.system,
    },
  };
};
