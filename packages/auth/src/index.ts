import type { AuthConfig, AuthPlugin } from "./types.js";
import { AuthUtils } from "./utils.js";
import { AuthHandlers } from "./handlers.js";
import { AuthMiddleware } from "./middleware.js";
import { createStorageAdapter } from "./storage/index.js";

export * from "./types.js";
export * from "./utils.js";
export { AuthHandlers as AuthHandlersClass } from "./handlers.js";
export { AuthMiddleware as AuthMiddlewareClass } from "./middleware.js";
export * from "./storage/index.js";
export * from "./providers/index.js";

/**
 * Create the main authentication plugin
 */
export function createAuthPlugin(config: AuthConfig): AuthPlugin {
  // Validate required configuration
  if (!config.storage) {
    throw new Error("Storage configuration is required");
  }

  if (!config.session?.secret) {
    throw new Error("Session secret is required");
  }

  // Create storage adapter
  const storage = createStorageAdapter(config.storage);

  // Create handlers and middleware
  const handlers = new AuthHandlers(config, storage);
  const middleware = new AuthMiddleware(config, storage);

  // Initialize storage
  storage.initialize().catch((error) => {
    console.error("Failed to initialize auth storage:", error);
  });

  // Create the plugin object
  const plugin: AuthPlugin = {
    config,
    storage,
    middleware: {
      requireAuth: middleware.requireAuth,
      optionalAuth: middleware.optionalAuth,
    },
    handlers: {
      login: handlers.login,
      register: handlers.register,
      logout: handlers.logout,
      me: handlers.me,
      oauth2: handlers.oauth2,
      oauth2Callback: handlers.oauth2Callback,
    },
    hashPassword: AuthUtils.hashPassword,
    verifyPassword: AuthUtils.verifyPassword,
    generateToken: AuthUtils.generateToken,
    generateJWT: async (payload: any) => {
      if (!config.jwt) {
        throw new Error("JWT configuration not provided");
      }
      return await AuthUtils.generateJWT(payload, config.jwt.secret, {
        expiresIn: config.jwt.expiresIn,
        algorithm: config.jwt.algorithm as any,
      });
    },
    verifyJWT: async (token: string) => {
      if (!config.jwt) {
        throw new Error("JWT configuration not provided");
      }
      return await AuthUtils.verifyJWT(token, config.jwt.secret);
    },
  };

  return plugin;
}

/**
 * Default configuration factory
 */
export function createDefaultAuthConfig(overrides: Partial<AuthConfig> = {}): AuthConfig {
  return {
    storage: {
      type: "sqlite",
      database: "./auth.db",
    },
    session: {
      secret: AuthUtils.generateToken(32),
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
      cookieName: "verb-auth-session",
    },
    jwt: {
      secret: AuthUtils.generateToken(32),
      expiresIn: "24h",
      algorithm: "HS256",
    },
    password: {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSymbols: false,
    },
    registration: {
      enabled: true,
      requireEmailVerification: false,
    },
    ...overrides,
  };
}

/**
 * Utility to extend an existing server with authentication
 */
export function withAuth(server: any, authPlugin: AuthPlugin) {
  // Add auth methods to server
  server.auth = {
    // Middleware
    requireAuth: authPlugin.middleware.requireAuth,
    optionalAuth: authPlugin.middleware.optionalAuth,
    requireRole: authPlugin.middleware.requireRole,
    requireEmailVerified: authPlugin.middleware.requireEmailVerified,
    rateLimit: authPlugin.middleware.rateLimit,

    // Handlers
    login: authPlugin.handlers.login,
    register: authPlugin.handlers.register,
    logout: authPlugin.handlers.logout,
    me: authPlugin.handlers.me,
    oauth2: authPlugin.handlers.oauth2,
    oauth2Callback: authPlugin.handlers.oauth2Callback,

    // Utilities
    hashPassword: authPlugin.hashPassword,
    verifyPassword: authPlugin.verifyPassword,
    generateToken: authPlugin.generateToken,
    generateJWT: authPlugin.generateJWT,
    verifyJWT: authPlugin.verifyJWT,

    // Storage access
    storage: authPlugin.storage,
    config: authPlugin.config,
  };

  // Add default auth routes if server supports route registration
  if (typeof server.post === "function" && typeof server.get === "function") {
    // Local auth routes
    server.post("/auth/login", authPlugin.handlers.login);
    server.post("/auth/register", authPlugin.handlers.register);
    server.post("/auth/logout", authPlugin.handlers.logout);
    server.get("/auth/me", authPlugin.middleware.requireAuth, authPlugin.handlers.me);

    // OAuth2 routes for configured providers
    if (authPlugin.config.providers) {
      for (const providerName of Object.keys(authPlugin.config.providers)) {
        server.get(`/auth/${providerName}`, authPlugin.handlers.oauth2(providerName));
        server.get(`/auth/${providerName}/callback`, authPlugin.handlers.oauth2Callback(providerName));
      }
    }
  }

  return server;
}

// Re-export commonly used types for convenience
export type {
  User,
  Session,
  AuthConfig,
  AuthPlugin,
  StorageAdapter,
  OAuth2Provider,
  AuthRequest,
} from "./types.js";