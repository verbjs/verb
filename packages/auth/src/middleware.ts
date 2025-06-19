import type { AuthConfig, StorageAdapter, AuthRequest, User, Session } from "./types.js";
import { AuthUtils } from "./utils.js";

export class AuthMiddleware {
  private config: AuthConfig;
  private storage: StorageAdapter;

  constructor(config: AuthConfig, storage: StorageAdapter) {
    this.config = config;
    this.storage = storage;
  }

  /**
   * Middleware that requires authentication
   */
  requireAuth = async (req: AuthRequest): Promise<Response | void> => {
    const authResult = await this.authenticate(req);
    
    if (!authResult.user) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { 
          status: 401, 
          headers: { "Content-Type": "application/json" } 
        }
      );
    }

    // Attach user and session to request
    req.user = authResult.user;
    req.session = authResult.session;
  };

  /**
   * Middleware that optionally authenticates (doesn't require authentication)
   */
  optionalAuth = async (req: AuthRequest): Promise<void> => {
    const authResult = await this.authenticate(req);
    
    // Attach user and session to request if available
    req.user = authResult.user;
    req.session = authResult.session;
  };

  /**
   * Authenticate a request using session cookie or JWT token
   */
  private async authenticate(req: AuthRequest): Promise<{
    user: User | null;
    session: Session | null;
  }> {
    // Try session authentication first
    const sessionResult = await this.authenticateSession(req);
    if (sessionResult.user) {
      return sessionResult;
    }

    // Try JWT authentication if enabled
    if (this.config.jwt) {
      const jwtResult = await this.authenticateJWT(req);
      if (jwtResult.user) {
        return jwtResult;
      }
    }

    return { user: null, session: null };
  }

  /**
   * Authenticate using session cookie
   */
  private async authenticateSession(req: AuthRequest): Promise<{
    user: User | null;
    session: Session | null;
  }> {
    try {
      const cookies = AuthUtils.parseCookies(req.headers.get("Cookie") || "");
      const cookieName = this.config.session.cookieName || "verb-auth-session";
      const sessionToken = cookies[cookieName];

      if (!sessionToken) {
        return { user: null, session: null };
      }

      // Get session from storage
      const session = await this.storage.getSession(sessionToken);
      if (!session) {
        return { user: null, session: null };
      }

      // Check if session is expired
      if (session.expiresAt <= new Date()) {
        // Clean up expired session
        await this.storage.deleteSession(session.id);
        return { user: null, session: null };
      }

      // Get user
      const user = await this.storage.getUserById(session.userId);
      if (!user) {
        // Clean up orphaned session
        await this.storage.deleteSession(session.id);
        return { user: null, session: null };
      }

      return { user, session };
    } catch (error) {
      console.error("Session authentication error:", error);
      return { user: null, session: null };
    }
  }

  /**
   * Authenticate using JWT token
   */
  private async authenticateJWT(req: AuthRequest): Promise<{
    user: User | null;
    session: Session | null;
  }> {
    try {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return { user: null, session: null };
      }

      const token = authHeader.substring(7); // Remove "Bearer " prefix
      
      // Verify JWT
      const payload = AuthUtils.verifyJWT(token, this.config.jwt!.secret);
      
      if (!payload.userId) {
        return { user: null, session: null };
      }

      // Get user
      const user = await this.storage.getUserById(payload.userId);
      if (!user) {
        return { user: null, session: null };
      }

      return { user, session: null };
    } catch (error) {
      console.error("JWT authentication error:", error);
      return { user: null, session: null };
    }
  }

  /**
   * Create a session management utility
   */
  createSessionManager() {
    return {
      /**
       * Create a new session for a user
       */
      createSession: async (userId: string, metadata?: Record<string, any>): Promise<Session> => {
        const sessionToken = AuthUtils.generateToken();
        return await this.storage.createSession({
          userId,
          token: sessionToken,
          expiresAt: new Date(Date.now() + this.config.session.maxAge),
          metadata,
        });
      },

      /**
       * Refresh a session (extend expiration)
       */
      refreshSession: async (sessionId: string): Promise<Session> => {
        return await this.storage.updateSession(sessionId, {
          expiresAt: new Date(Date.now() + this.config.session.maxAge),
        });
      },

      /**
       * Invalidate a session
       */
      invalidateSession: async (sessionId: string): Promise<boolean> => {
        return await this.storage.deleteSession(sessionId);
      },

      /**
       * Invalidate all sessions for a user
       */
      invalidateUserSessions: async (userId: string): Promise<number> => {
        return await this.storage.deleteUserSessions(userId);
      },

      /**
       * Clean up expired sessions
       */
      cleanupExpiredSessions: async (): Promise<number> => {
        return await this.storage.cleanupExpiredSessions();
      },

      /**
       * Generate session cookie for response
       */
      generateSessionCookie: (sessionToken: string): string => {
        const cookieName = this.config.session.cookieName || "verb-auth-session";
        return AuthUtils.generateSessionCookie(cookieName, sessionToken, {
          maxAge: this.config.session.maxAge,
          secure: this.config.session.secure,
          httpOnly: this.config.session.httpOnly,
          sameSite: this.config.session.sameSite,
        });
      },

      /**
       * Generate clear session cookie for logout
       */
      generateClearSessionCookie: (): string => {
        const cookieName = this.config.session.cookieName || "verb-auth-session";
        return `${cookieName}=; Max-Age=0; Path=/; HttpOnly`;
      },
    };
  }

  /**
   * Create JWT utilities
   */
  createJWTManager() {
    if (!this.config.jwt) {
      throw new Error("JWT configuration not provided");
    }

    return {
      /**
       * Generate a JWT token for a user
       */
      generateToken: (user: User, extraPayload?: Record<string, any>): string => {
        const payload = {
          userId: user.id,
          email: user.email,
          provider: user.provider,
          ...extraPayload,
        };

        return AuthUtils.generateJWT(
          payload,
          this.config.jwt!.secret,
          {
            expiresIn: this.config.jwt!.expiresIn,
            algorithm: this.config.jwt!.algorithm as any,
          }
        );
      },

      /**
       * Verify and decode a JWT token
       */
      verifyToken: (token: string): any => {
        return AuthUtils.verifyJWT(token, this.config.jwt!.secret);
      },

      /**
       * Generate refresh token
       */
      generateRefreshToken: (): string => {
        return AuthUtils.generateToken(64);
      },
    };
  }

  /**
   * Role-based access control middleware
   */
  requireRole = (requiredRoles: string | string[]) => {
    const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
    
    return async (req: AuthRequest): Promise<Response | void> => {
      // First ensure user is authenticated
      const authResponse = await this.requireAuth(req);
      if (authResponse) {
        return authResponse; // Authentication failed
      }

      const user = req.user!;
      const userRoles = user.metadata?.roles || [];

      // Check if user has any of the required roles
      const hasRequiredRole = roles.some(role => userRoles.includes(role));
      
      if (!hasRequiredRole) {
        return new Response(
          JSON.stringify({ 
            error: "Insufficient permissions",
            required: roles,
            current: userRoles
          }),
          { 
            status: 403, 
            headers: { "Content-Type": "application/json" } 
          }
        );
      }
    };
  };

  /**
   * Email verification middleware
   */
  requireEmailVerified = async (req: AuthRequest): Promise<Response | void> => {
    // First ensure user is authenticated
    const authResponse = await this.requireAuth(req);
    if (authResponse) {
      return authResponse; // Authentication failed
    }

    const user = req.user!;
    
    if (!user.emailVerified) {
      return new Response(
        JSON.stringify({ 
          error: "Email verification required",
          message: "Please verify your email address to access this resource"
        }),
        { 
          status: 403, 
          headers: { "Content-Type": "application/json" } 
        }
      );
    }
  };

  /**
   * Rate limiting middleware (basic implementation)
   */
  rateLimit = (maxRequests: number, windowMs: number) => {
    const requests = new Map<string, { count: number; resetTime: number }>();

    return async (req: AuthRequest): Promise<Response | void> => {
      const clientId = req.user?.id || req.headers.get("X-Forwarded-For") || "anonymous";
      const now = Date.now();
      
      const clientData = requests.get(clientId);
      
      if (!clientData || now > clientData.resetTime) {
        // Reset window
        requests.set(clientId, {
          count: 1,
          resetTime: now + windowMs
        });
        return;
      }
      
      if (clientData.count >= maxRequests) {
        const resetIn = Math.ceil((clientData.resetTime - now) / 1000);
        
        return new Response(
          JSON.stringify({ 
            error: "Rate limit exceeded",
            retryAfter: resetIn
          }),
          { 
            status: 429, 
            headers: { 
              "Content-Type": "application/json",
              "Retry-After": resetIn.toString()
            } 
          }
        );
      }
      
      clientData.count++;
    };
  };
}