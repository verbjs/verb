import type { Middleware } from "./types.ts";

/**
 * Log levels in order of severity
 */
export enum LogLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4,
  FATAL = 5,
}

/**
 * Log entry structure
 */
export interface LogEntry {
  /** Timestamp in ISO format */
  timestamp: string;
  /** Log level */
  level: LogLevel;
  /** Log level name */
  levelName: string;
  /** Log message */
  message: string;
  /** Request correlation ID */
  correlationId?: string;
  /** Additional metadata */
  meta?: Record<string, any>;
  /** Error object if present */
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  /** Request details */
  request?: {
    method: string;
    url: string;
    userAgent?: string;
    ip?: string;
    headers?: Record<string, string>;
  };
  /** Response details */
  response?: {
    status: number;
    responseTime?: number;
    contentLength?: number;
  };
  /** Application context */
  context?: {
    service?: string;
    version?: string;
    environment?: string;
    nodeId?: string;
  };
}

/**
 * Logger configuration options
 */
export interface LoggerOptions {
  /** Minimum log level to output */
  level?: LogLevel;
  /** Pretty print logs for development */
  prettyPrint?: boolean;
  /** Include stack traces in error logs */
  includeStackTrace?: boolean;
  /** Log destination (console, file, custom) */
  destination?: "console" | "file" | LogDestination;
  /** File path for file logging */
  filePath?: string;
  /** Application context */
  context?: {
    service?: string;
    version?: string;
    environment?: string;
    nodeId?: string;
  };
  /** Custom log formatter */
  formatter?: (entry: LogEntry) => string;
  /** Log sampling rate (0-1) for high-volume scenarios */
  sampleRate?: number;
}

/**
 * Custom log destination interface
 */
export interface LogDestination {
  write(entry: LogEntry): Promise<void> | void;
  flush?(): Promise<void> | void;
}

/**
 * Logger state
 */
export interface LoggerState {
  readonly options: LoggerOptions;
  readonly destination: LogDestination;
  readonly correlationId?: string;
}

/**
 * Log level names
 */
const LOG_LEVEL_NAMES: Record<LogLevel, string> = {
  [LogLevel.TRACE]: "TRACE",
  [LogLevel.DEBUG]: "DEBUG",
  [LogLevel.INFO]: "INFO",
  [LogLevel.WARN]: "WARN",
  [LogLevel.ERROR]: "ERROR",
  [LogLevel.FATAL]: "FATAL",
};

/**
 * ANSI color codes for pretty printing
 */
const COLORS = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m",
};

/**
 * Level colors for pretty printing
 */
const LEVEL_COLORS: Record<LogLevel, string> = {
  [LogLevel.TRACE]: COLORS.gray,
  [LogLevel.DEBUG]: COLORS.blue,
  [LogLevel.INFO]: COLORS.green,
  [LogLevel.WARN]: COLORS.yellow,
  [LogLevel.ERROR]: COLORS.red,
  [LogLevel.FATAL]: COLORS.magenta,
};

/**
 * Generates a unique correlation ID
 */
function generateCorrelationId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${random}`;
}

/**
 * Extracts client IP from request
 */
function getClientIP(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");
  const cfConnectingIp = req.headers.get("cf-connecting-ip");

  if (cfConnectingIp) {
    return cfConnectingIp;
  }
  if (realIp) {
    return realIp;
  }
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return "unknown";
}

/**
 * File destination state
 */
interface FileDestinationState {
  readonly filePath: string;
  readonly writer?: WritableStreamDefaultWriter;
}

/**
 * Create file destination state
 */
const createFileDestinationState = (filePath: string): FileDestinationState => ({
  filePath,
  writer: undefined,
});

/**
 * File destination write function
 */
const fileDestinationWrite = async (
  state: FileDestinationState,
  entry: LogEntry,
): Promise<void> => {
  const line = `${JSON.stringify(entry)}\n`;
  try {
    await Bun.write(Bun.file(state.filePath), line);
  } catch {
    // Fallback for compatibility
    console.log(JSON.stringify(entry));
  }
};

/**
 * File destination flush function
 */
const fileDestinationFlush = async (_state: FileDestinationState): Promise<void> => {
  // File is automatically flushed with Bun.write
};

/**
 * Create file destination
 */
export const createFileDestination = (filePath: string): LogDestination => {
  const state = createFileDestinationState(filePath);

  return {
    write: (entry: LogEntry) => fileDestinationWrite(state, entry),
    flush: () => fileDestinationFlush(state),
  };
};

/**
 * Console destination state
 */
interface ConsoleDestinationState {
  readonly prettyPrint: boolean;
}

/**
 * Create console destination state
 */
const createConsoleDestinationState = (prettyPrint = false): ConsoleDestinationState => ({
  prettyPrint,
});

/**
 * Console destination write function
 */
const consoleDestinationWrite = (state: ConsoleDestinationState, entry: LogEntry): void => {
  if (state.prettyPrint) {
    consoleDestinationWritePretty(entry);
  } else {
    console.log(JSON.stringify(entry));
  }
};

/**
 * Console destination pretty write function
 */
const consoleDestinationWritePretty = (entry: LogEntry): void => {
  const color = LEVEL_COLORS[entry.level];
  const time = new Date(entry.timestamp).toLocaleTimeString();

  let output = `${COLORS.gray}${time}${COLORS.reset} `;
  output += `${color}${entry.levelName.padEnd(5)}${COLORS.reset} `;

  if (entry.correlationId) {
    output += `${COLORS.cyan}[${entry.correlationId}]${COLORS.reset} `;
  }

  output += entry.message;

  if (entry.meta && Object.keys(entry.meta).length > 0) {
    output += ` ${COLORS.dim}${JSON.stringify(entry.meta)}${COLORS.reset}`;
  }

  if (entry.error) {
    output += `\n${COLORS.red}Error: ${entry.error.message}${COLORS.reset}`;
    if (entry.error.stack) {
      output += `\n${COLORS.dim}${entry.error.stack}${COLORS.reset}`;
    }
  }

  console.log(output);
};

/**
 * Create console destination
 */
export const createConsoleDestination = (prettyPrint = false): LogDestination => {
  const state = createConsoleDestinationState(prettyPrint);

  return {
    write: (entry: LogEntry) => consoleDestinationWrite(state, entry),
  };
};

/**
 * Create logger state
 */
export const createLoggerState = (options: LoggerOptions = {}): LoggerState => {
  const {
    level = LogLevel.INFO,
    prettyPrint = false,
    destination = "console",
    filePath = "./app.log",
  } = options;

  // Set up destination
  let logDestination: LogDestination;
  if (typeof destination === "string") {
    if (destination === "file") {
      logDestination = createFileDestination(filePath);
    } else {
      logDestination = createConsoleDestination(prettyPrint);
    }
  } else {
    logDestination = destination;
  }

  return {
    options: { ...options, level },
    destination: logDestination,
    correlationId: undefined,
  };
};

/**
 * Create child logger with correlation ID
 */
export const createChildLogger = (state: LoggerState, correlationId: string): LoggerState => ({
  ...state,
  correlationId,
});

/**
 * Check if a log level should be logged
 */
export const shouldLog = (state: LoggerState, level: LogLevel): boolean => {
  return level >= (state.options.level || LogLevel.INFO);
};

/**
 * Log at specified level
 */
export const log = async (
  state: LoggerState,
  level: LogLevel,
  message: string,
  meta?: Record<string, any>,
  error?: Error,
): Promise<void> => {
  if (!shouldLog(state, level)) {
    return;
  }

  // Apply sampling if configured
  if (state.options.sampleRate && Math.random() > state.options.sampleRate) {
    return;
  }

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    levelName: LOG_LEVEL_NAMES[level],
    message,
    correlationId: state.correlationId,
    meta,
    context: state.options.context,
  };

  if (error) {
    entry.error = {
      name: error.name,
      message: error.message,
      stack: state.options.includeStackTrace ? error.stack : undefined,
    };
  }

  // Use custom formatter if provided
  if (state.options.formatter) {
    console.log(state.options.formatter(entry));
  } else {
    await state.destination.write(entry);
  }
};

/**
 * Log trace level message
 */
export const trace = (
  state: LoggerState,
  message: string,
  meta?: Record<string, any>,
): Promise<void> => {
  return log(state, LogLevel.TRACE, message, meta);
};

/**
 * Log debug level message
 */
export const debug = (
  state: LoggerState,
  message: string,
  meta?: Record<string, any>,
): Promise<void> => {
  return log(state, LogLevel.DEBUG, message, meta);
};

/**
 * Log info level message
 */
export const info = (
  state: LoggerState,
  message: string,
  meta?: Record<string, any>,
): Promise<void> => {
  return log(state, LogLevel.INFO, message, meta);
};

/**
 * Log warning level message
 */
export const warn = (
  state: LoggerState,
  message: string,
  meta?: Record<string, any>,
): Promise<void> => {
  return log(state, LogLevel.WARN, message, meta);
};

/**
 * Log error level message
 */
export const logError = (
  state: LoggerState,
  message: string,
  error?: Error,
  meta?: Record<string, any>,
): Promise<void> => {
  return log(state, LogLevel.ERROR, message, meta, error);
};

/**
 * Log error level message (alias for backward compatibility)
 */
export const error = logError;

/**
 * Log fatal level message
 */
export const fatal = (
  state: LoggerState,
  message: string,
  error?: Error,
  meta?: Record<string, any>,
): Promise<void> => {
  return log(state, LogLevel.FATAL, message, meta, error);
};

/**
 * Log request details
 */
export const logRequest = async (
  state: LoggerState,
  req: Request,
  meta?: Record<string, any>,
): Promise<void> => {
  if (!shouldLog(state, LogLevel.INFO)) {
    return;
  }

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level: LogLevel.INFO,
    levelName: "INFO",
    message: `${req.method} ${new URL(req.url).pathname}`,
    correlationId: state.correlationId,
    context: state.options.context,
    request: {
      method: req.method,
      url: req.url,
      userAgent: req.headers.get("user-agent") || undefined,
      ip: getClientIP(req),
    },
    meta,
  };

  await state.destination.write(entry);
};

/**
 * Log response details
 */
export const logResponse = async (
  state: LoggerState,
  req: Request,
  response: Response,
  responseTime: number,
  meta?: Record<string, any>,
): Promise<void> => {
  if (!shouldLog(state, LogLevel.INFO)) {
    return;
  }

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level: LogLevel.INFO,
    levelName: "INFO",
    message: `${req.method} ${new URL(req.url).pathname} ${response.status} ${responseTime}ms`,
    correlationId: state.correlationId,
    context: state.options.context,
    request: {
      method: req.method,
      url: req.url,
      ip: getClientIP(req),
    },
    response: {
      status: response.status,
      responseTime,
      contentLength: Number.parseInt(response.headers.get("content-length") || "0") || undefined,
    },
    meta,
  };

  await state.destination.write(entry);
};

/**
 * Flush pending logs
 */
export const flush = async (state: LoggerState): Promise<void> => {
  if (state.destination.flush) {
    await state.destination.flush();
  }
};

/**
 * Global logger state
 */
let globalLoggerState: LoggerState;

/**
 * Initialize global logger
 */
export function initLogger(options: LoggerOptions = {}): LoggerState {
  globalLoggerState = createLoggerState(options);
  return globalLoggerState;
}

/**
 * Get global logger state
 */
export function getLogger(): LoggerState {
  if (!globalLoggerState) {
    globalLoggerState = createLoggerState();
  }
  return globalLoggerState;
}

/**
 * Request logging middleware
 */
export function requestLogger(options: LoggerOptions = {}): Middleware {
  const loggerState = createLoggerState(options);

  return async (req: Request, next) => {
    const startTime = Date.now();
    const correlationId = req.headers.get("x-correlation-id") || generateCorrelationId();
    const requestLoggerState = createChildLogger(loggerState, correlationId);

    // Add correlation ID to request for downstream use
    (req as any).correlationId = correlationId;
    (req as any).logger = requestLoggerState;

    // Log incoming request
    await logRequest(requestLoggerState, req);

    try {
      const response = await next();
      const responseTime = Date.now() - startTime;

      // Log successful response
      await logResponse(requestLoggerState, req, response, responseTime);

      // Add correlation ID to response headers
      const headers = new Headers(response.headers);
      headers.set("x-correlation-id", correlationId);

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch (err) {
      const responseTime = Date.now() - startTime;

      // Log error
      await logError(
        requestLoggerState,
        `Request failed: ${err instanceof Error ? err.message : "Unknown error"}`,
        err instanceof Error ? err : undefined,
        { responseTime },
      );

      throw err;
    }
  };
}

/**
 * Performance logging middleware
 */
export function performanceLogger(slowRequestThreshold = 1000): Middleware {
  const loggerState = getLogger();

  return async (req: Request, next) => {
    const startTime = Date.now();
    const response = await next();
    const responseTime = Date.now() - startTime;

    if (responseTime > slowRequestThreshold) {
      await warn(loggerState, "Slow request detected", {
        method: req.method,
        url: req.url,
        responseTime,
        threshold: slowRequestThreshold,
      });
    }

    return response;
  };
}

/**
 * Error logging middleware
 */
export function errorLogger(): Middleware {
  const loggerState = getLogger();

  return async (req: Request, next) => {
    try {
      return await next();
    } catch (err) {
      await logError(
        loggerState,
        `Unhandled error in request: ${req.method} ${req.url}`,
        err instanceof Error ? err : new Error(String(err)),
        {
          method: req.method,
          url: req.url,
          userAgent: req.headers.get("user-agent"),
          ip: getClientIP(req),
        },
      );

      throw err;
    }
  };
}

/**
 * Create development logger
 */
export function createDevelopmentLogger(): LoggerState {
  return createLoggerState({
    level: LogLevel.DEBUG,
    prettyPrint: true,
    includeStackTrace: true,
    context: {
      environment: "development",
    },
  });
}

/**
 * Create production logger
 */
export function createProductionLogger(options: Partial<LoggerOptions> = {}): LoggerState {
  return createLoggerState({
    level: LogLevel.INFO,
    prettyPrint: false,
    includeStackTrace: false,
    context: {
      environment: "production",
    },
    ...options,
  });
}

// Legacy class-based export for backward compatibility
export class Logger {
  private state: LoggerState;

  constructor(options: LoggerOptions = {}) {
    this.state = createLoggerState(options);
  }

  child(correlationId: string): Logger {
    const childLogger = new Logger(this.state.options);
    childLogger.state = createChildLogger(this.state, correlationId);
    return childLogger;
  }

  shouldLog(level: LogLevel): boolean {
    return shouldLog(this.state, level);
  }

  async trace(message: string, meta?: Record<string, any>): Promise<void> {
    return trace(this.state, message, meta);
  }

  async debug(message: string, meta?: Record<string, any>): Promise<void> {
    return debug(this.state, message, meta);
  }

  async info(message: string, meta?: Record<string, any>): Promise<void> {
    return info(this.state, message, meta);
  }

  async warn(message: string, meta?: Record<string, any>): Promise<void> {
    return warn(this.state, message, meta);
  }

  async error(message: string, error?: Error, meta?: Record<string, any>): Promise<void> {
    return logError(this.state, message, error, meta);
  }

  async fatal(message: string, error?: Error, meta?: Record<string, any>): Promise<void> {
    return fatal(this.state, message, error, meta);
  }

  async logRequest(req: Request, meta?: Record<string, any>): Promise<void> {
    return logRequest(this.state, req, meta);
  }

  async logResponse(
    req: Request,
    response: Response,
    responseTime: number,
    meta?: Record<string, any>,
  ): Promise<void> {
    return logResponse(this.state, req, response, responseTime, meta);
  }

  async flush(): Promise<void> {
    return flush(this.state);
  }
}
