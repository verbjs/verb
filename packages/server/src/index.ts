export {
  createServer,
  createHttp2Server,
  createWebSocketServer,
  createEchoServer,
  createChatServer,
  WebSocketClient,
  createUDPServer,
  createUDPEchoServer,
  createDiscoveryServer,
  createMulticastGroup,
  UDPClient,
} from "./server/index.ts";

export type { WebSocketHandler, UDPHandler } from "./server/index.ts";
export { createMockServer } from "./mock.ts";

export {
  json,
  text,
  html,
  error,
  stream,
  streamFile,
  streamSSE,
  streamJSON,
  streamText,
  redirect,
  noContent,
  notFound,
} from "./response.ts";

export {
  parseBody,
  getQuery,
  getCookies,
} from "./request.ts";

export {
  parseMultipart,
  isMultipartRequest,
  saveFile,
  createTempFile,
} from "./upload.ts";

export type {
  UploadedFile,
  MultipartData,
  MultipartOptions,
} from "./upload.ts";

export {
  serveStatic,
  staticFiles,
} from "./static.ts";

export {
  createPushHeader,
  responseWithPush,
  StreamPriority,
  createHttp2Headers,
  http2Middleware,
  generateDevCert,
  isHttp2Preface,
} from "./server/http2.ts";

export {
  compression,
  gzip,
  deflate,
  productionCompression,
  developmentCompression,
} from "./compression.ts";

export type {
  Handler,
  Middleware,
  Method,
} from "./types.ts";

export type { MountableApp } from "./mount.ts";

// Router exports
export {
  createRouter,
  addRoute,
  addMiddleware,
  findRoute,
  handleRequest,
  createFilesystemRouter,
  scanRoutes,
  addFilesystemMiddleware,
  findFilesystemRoute,
  handleFilesystemRequest,
  getFilesystemRoutes,
  reloadRoute,
  clearFilesystemRoutes,
  createUniversalRouter,
  RouterType,
  defaultRouterConfig,
} from "./routers/index.ts";

export type {
  Router,
  Route,
  RouteMatch,
  RadixNode,
  FilesystemRouterState,
  FilesystemRouterOptions,
  FileRoute,
  UniversalRouter,
  RouterConfig,
} from "./routers/index.ts";

// P0 Critical Features
export {
  validateSchema,
  withSchema,
  schema,
  createSchemaValidationError,
  isSchemaValidationError,
  SchemaValidationError,
  serializeResponse,
} from "./validation.ts";

export type {
  JsonSchema,
  RouteSchema,
  SchemaValidationErrorData,
} from "./validation.ts";

export {
  securityHeaders,
  csrfProtection,
  generateCSRFToken,
  inputSanitization,
  defaultSecurity,
  stripHtml,
  stripScripts,
  removeNullBytes,
  sanitizeString,
  sanitizeObject,
  InputSanitizer,
} from "./security.ts";

export type {
  SecurityOptions,
  CSRFOptions,
  SanitizationOptions,
} from "./security.ts";

export {
  rateLimit,
  rateLimitByIP,
  rateLimitByEndpoint,
  rateLimitByUser,
  strictRateLimit,
  createMemoryStore,
  createSlidingWindowStore,
  createTokenBucketStore,
  MemoryStore,
  SlidingWindowStore,
  TokenBucketStore,
} from "./rate-limit.ts";

export type {
  RateLimitOptions,
  RateLimitInfo,
  RateLimitStore,
} from "./rate-limit.ts";

export {
  createLoggerState,
  createChildLogger,
  createFileDestination,
  createConsoleDestination,
  shouldLog,
  log,
  trace,
  debug,
  info,
  warn,
  logError,
  fatal,
  logRequest,
  logResponse,
  flush,
  Logger,
  LogLevel,
  initLogger,
  getLogger,
  requestLogger,
  performanceLogger,
  errorLogger,
  createDevelopmentLogger,
  createProductionLogger,
} from "./logger.ts";

export type {
  LogEntry,
  LoggerOptions,
  LogDestination,
  LoggerState,
} from "./logger.ts";

// P1 High Priority Features
export {
  createVerbError,
  createBadRequestError,
  createUnauthorizedError,
  createForbiddenError,
  createNotFoundError,
  createConflictError,
  createValidationError,
  createRateLimitError,
  createInternalServerError,
  isVerbError,
  toVerbError,
  errorHandler,
  defaultErrorHandler,
  serializeError,
  asyncHandler,
  createErrorBoundary,
  registerErrorHandler,
  setFallbackHandler,
  handleError,
  errorBoundaryMiddleware,
  throwError,
  errors,
  VerbError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
  RateLimitError,
  InternalServerError,
  ErrorBoundary,
} from "./error.ts";

export type {
  VerbErrorData,
  ErrorCode,
  ErrorHandler,
  ErrorHandlerOptions,
  ErrorBoundaryState,
} from "./error.ts";

export {
  createPluginManager,
  registerPlugin,
  startPlugins,
  stopPlugins,
  getPlugin,
  getPlugins,
  getPluginMetadata,
  hasPlugin,
  getService,
  getServices,
  createPluginBuilder,
  setMetadata,
  setName,
  setVersion,
  setDescription,
  setDependencies,
  addHooks,
  onRegister,
  setConfig,
  buildPlugin,
  createPlugin,
  plugin,
  PluginManager,
  PluginBuilder,
} from "./plugin.ts";

export type {
  Plugin,
  PluginMetadata,
  PluginHooks,
  PluginContext,
  PluginRegistrationOptions,
  PluginManagerState,
  PluginBuilderState,
} from "./plugin.ts";

// React renderer exports
export {
  createReactRendererPlugin,
} from "./plugins/react/renderer.ts";

export type {
  ReactRendererConfig,
  RenderOptions,
} from "./plugins/react/renderer.ts";

export {
  reactComponent,
  renderToString,
  renderToStream,
  React,
} from "./react.ts";

export {
  createMemorySessionStore,
  createRedisSessionStore,
  createSessionManagerState,
  createSessionMiddleware,
  MemorySessionStore,
  RedisSessionStore,
  SessionManager,
  session,
  getSession,
  setSessionData,
  getSessionData,
  clearSessionData,
  destroySession,
  generateSessionId,
  sign,
  unsign,
  parseCookies,
  serializeCookie,
} from "./session.ts";

export type {
  Session,
  SessionData,
  SessionStore,
  SessionOptions,
  SessionCookieOptions,
  SessionManagerState,
} from "./session.ts";
