import type {
  AuthConfig,
  StorageAdapter,
  AuthRequest,
  LoginCredentials,
  RegisterCredentials,
  OAuth2Provider,
} from "./types.js";
import { AuthUtils } from "./utils.js";
import { OAuth2UserInfoNormalizer, createOAuth2Provider } from "./providers/index.js";

export class AuthHandlers {
  private config: AuthConfig;
  private storage: StorageAdapter;
  private providers: Map<string, OAuth2Provider> = new Map();

  constructor(config: AuthConfig, storage: StorageAdapter) {
    this.config = config;
    this.storage = storage;
    this.initializeProviders();
  }

  private initializeProviders(): void {
    if (this.config.providers) {
      for (const [name, providerConfig] of Object.entries(this.config.providers)) {
        try {
          const provider = createOAuth2Provider(name, providerConfig);
          this.providers.set(name, provider);
        } catch (error) {
          console.warn(`Failed to initialize OAuth2 provider ${name}: ${error.message}`);
        }
      }
    }
  }

  /**
   * Handle local login
   */
  login = async (req: Request): Promise<Response> => {
    try {
      const body = await req.json();
      const credentials = body as LoginCredentials;

      if (!credentials.password) {
        return new Response(
          JSON.stringify({ error: "Password is required" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // Find user by email or username
      let user = null;
      if (credentials.email) {
        if (!AuthUtils.isValidEmail(credentials.email)) {
          return new Response(
            JSON.stringify({ error: "Invalid email format" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }
        user = await this.storage.getUserByEmail(credentials.email);
      } else if (credentials.username) {
        user = await this.storage.getUserByUsername(credentials.username);
      } else {
        return new Response(
          JSON.stringify({ error: "Email or username is required" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      if (!user || !user.passwordHash) {
        return new Response(
          JSON.stringify({ error: "Invalid credentials" }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        );
      }

      // Verify password
      const isValidPassword = await AuthUtils.verifyPassword(
        credentials.password,
        user.passwordHash
      );

      if (!isValidPassword) {
        return new Response(
          JSON.stringify({ error: "Invalid credentials" }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        );
      }

      // Create session
      const sessionToken = AuthUtils.generateToken();
      const session = await this.storage.createSession({
        userId: user.id,
        token: sessionToken,
        expiresAt: new Date(Date.now() + this.config.session.maxAge),
      });

      // Set session cookie
      const cookieName = this.config.session.cookieName || "verb-auth-session";
      const cookie = AuthUtils.generateSessionCookie(cookieName, sessionToken, {
        maxAge: this.config.session.maxAge,
        secure: this.config.session.secure,
        httpOnly: this.config.session.httpOnly,
        sameSite: this.config.session.sameSite,
      });

      return new Response(
        JSON.stringify({
          user: AuthUtils.sanitizeUser(user),
          session: { id: session.id, expiresAt: session.expiresAt },
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Set-Cookie": cookie,
          },
        }
      );
    } catch (error) {
      console.error("Login error:", error);
      return new Response(
        JSON.stringify({ error: "Internal server error" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  };

  /**
   * Handle user registration
   */
  register = async (req: Request): Promise<Response> => {
    try {
      if (!this.config.registration?.enabled) {
        return new Response(
          JSON.stringify({ error: "Registration is disabled" }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      }

      const body = await req.json();
      const credentials = body as RegisterCredentials;

      // Validate required fields
      if (!credentials.email || !credentials.password) {
        return new Response(
          JSON.stringify({ error: "Email and password are required" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // Validate email format
      if (!AuthUtils.isValidEmail(credentials.email)) {
        return new Response(
          JSON.stringify({ error: "Invalid email format" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // Check allowed domains
      if (this.config.registration?.allowedDomains) {
        const emailDomain = credentials.email.split("@")[1];
        if (!this.config.registration.allowedDomains.includes(emailDomain)) {
          return new Response(
            JSON.stringify({ error: "Email domain not allowed" }),
            { status: 403, headers: { "Content-Type": "application/json" } }
          );
        }
      }

      // Validate password strength
      const passwordValidation = AuthUtils.validatePassword(
        credentials.password,
        this.config.password
      );
      if (!passwordValidation.valid) {
        return new Response(
          JSON.stringify({ error: "Password validation failed", details: passwordValidation.errors }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // Check if user already exists
      const existingUser = await this.storage.getUserByEmail(credentials.email);
      if (existingUser) {
        return new Response(
          JSON.stringify({ error: "User already exists" }),
          { status: 409, headers: { "Content-Type": "application/json" } }
        );
      }

      // Check username if provided
      if (credentials.username) {
        const existingUsername = await this.storage.getUserByUsername(credentials.username);
        if (existingUsername) {
          return new Response(
            JSON.stringify({ error: "Username already taken" }),
            { status: 409, headers: { "Content-Type": "application/json" } }
          );
        }
      }

      // Hash password
      const passwordHash = await AuthUtils.hashPassword(credentials.password);

      // Create user
      const user = await this.storage.createUser({
        email: credentials.email,
        username: credentials.username,
        name: credentials.name,
        provider: "local",
        passwordHash,
        emailVerified: !this.config.registration?.requireEmailVerification,
      });

      // Create session
      const sessionToken = AuthUtils.generateToken();
      const session = await this.storage.createSession({
        userId: user.id,
        token: sessionToken,
        expiresAt: new Date(Date.now() + this.config.session.maxAge),
      });

      // Set session cookie
      const cookieName = this.config.session.cookieName || "verb-auth-session";
      const cookie = AuthUtils.generateSessionCookie(cookieName, sessionToken, {
        maxAge: this.config.session.maxAge,
        secure: this.config.session.secure,
        httpOnly: this.config.session.httpOnly,
        sameSite: this.config.session.sameSite,
      });

      return new Response(
        JSON.stringify({
          user: AuthUtils.sanitizeUser(user),
          session: { id: session.id, expiresAt: session.expiresAt },
        }),
        {
          status: 201,
          headers: {
            "Content-Type": "application/json",
            "Set-Cookie": cookie,
          },
        }
      );
    } catch (error) {
      console.error("Registration error:", error);
      return new Response(
        JSON.stringify({ error: "Internal server error" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  };

  /**
   * Handle logout
   */
  logout = async (req: AuthRequest): Promise<Response> => {
    try {
      const cookies = AuthUtils.parseCookies(req.headers.get("Cookie") || "");
      const cookieName = this.config.session.cookieName || "verb-auth-session";
      const sessionToken = cookies[cookieName];

      if (sessionToken) {
        const session = await this.storage.getSession(sessionToken);
        if (session) {
          await this.storage.deleteSession(session.id);
        }
      }

      // Clear session cookie
      const clearCookie = `${cookieName}=; Max-Age=0; Path=/; HttpOnly`;

      return new Response(
        JSON.stringify({ message: "Logged out successfully" }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Set-Cookie": clearCookie,
          },
        }
      );
    } catch (error) {
      console.error("Logout error:", error);
      return new Response(
        JSON.stringify({ error: "Internal server error" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  };

  /**
   * Get current user info
   */
  me = async (req: AuthRequest): Promise<Response> => {
    try {
      if (!req.user) {
        return new Response(
          JSON.stringify({ error: "Not authenticated" }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ user: AuthUtils.sanitizeUser(req.user) }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } catch (error) {
      console.error("Me error:", error);
      return new Response(
        JSON.stringify({ error: "Internal server error" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  };

  /**
   * OAuth2 login redirect
   */
  oauth2 = (providerName: string) => async (req: Request): Promise<Response> => {
    try {
      const provider = this.providers.get(providerName);
      if (!provider) {
        return new Response(
          JSON.stringify({ error: `OAuth2 provider ${providerName} not configured` }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const state = AuthUtils.generateOAuth2State();
      const authUrl = AuthUtils.buildOAuth2Url(
        provider.authUrl,
        provider.clientId,
        provider.redirectUri,
        provider.scope,
        state
      );

      // Store state in session/cookie for verification
      const stateCookie = AuthUtils.generateSessionCookie(
        `oauth2-state-${providerName}`,
        state,
        { maxAge: 10 * 60 * 1000 } // 10 minutes
      );

      return new Response(null, {
        status: 302,
        headers: {
          Location: authUrl,
          "Set-Cookie": stateCookie,
        },
      });
    } catch (error) {
      console.error("OAuth2 redirect error:", error);
      return new Response(
        JSON.stringify({ error: "Internal server error" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  };

  /**
   * OAuth2 callback handler
   */
  oauth2Callback = (providerName: string) => async (req: Request): Promise<Response> => {
    try {
      const url = new URL(req.url);
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const error = url.searchParams.get("error");

      if (error) {
        return new Response(
          JSON.stringify({ error: `OAuth2 error: ${error}` }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      if (!code) {
        return new Response(
          JSON.stringify({ error: "Authorization code not provided" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const provider = this.providers.get(providerName);
      if (!provider) {
        return new Response(
          JSON.stringify({ error: `OAuth2 provider ${providerName} not configured` }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // Verify state parameter
      const cookies = AuthUtils.parseCookies(req.headers.get("Cookie") || "");
      const expectedState = cookies[`oauth2-state-${providerName}`];
      if (state !== expectedState) {
        return new Response(
          JSON.stringify({ error: "Invalid state parameter" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // Exchange code for access token
      const tokenResponse = await AuthUtils.exchangeOAuth2Code(
        provider.tokenUrl,
        provider.clientId,
        provider.clientSecret,
        code,
        provider.redirectUri
      );

      // Fetch user info
      const userInfo = await AuthUtils.fetchOAuth2UserInfo(
        provider.userInfoUrl,
        tokenResponse.access_token
      );

      // Normalize user info
      const normalizedUserInfo = OAuth2UserInfoNormalizer.normalize(providerName, userInfo);

      // Check if user exists
      let user = await this.storage.getUserByProvider(
        providerName,
        normalizedUserInfo.id
      );

      if (!user) {
        // Create new user
        user = await this.storage.createUser({
          email: normalizedUserInfo.email,
          username: normalizedUserInfo.username,
          name: normalizedUserInfo.name,
          avatar: normalizedUserInfo.avatar,
          provider: providerName,
          providerId: normalizedUserInfo.id,
          emailVerified: normalizedUserInfo.verified || false,
        });
      } else {
        // Update existing user
        user = await this.storage.updateUser(user.id, {
          name: normalizedUserInfo.name,
          avatar: normalizedUserInfo.avatar,
          emailVerified: normalizedUserInfo.verified || user.emailVerified,
          updatedAt: new Date(),
        });
      }

      // Create session
      const sessionToken = AuthUtils.generateToken();
      const session = await this.storage.createSession({
        userId: user.id,
        token: sessionToken,
        expiresAt: new Date(Date.now() + this.config.session.maxAge),
      });

      // Set session cookie and clear state cookie
      const cookieName = this.config.session.cookieName || "verb-auth-session";
      const sessionCookie = AuthUtils.generateSessionCookie(cookieName, sessionToken, {
        maxAge: this.config.session.maxAge,
        secure: this.config.session.secure,
        httpOnly: this.config.session.httpOnly,
        sameSite: this.config.session.sameSite,
      });

      const clearStateCookie = `oauth2-state-${providerName}=; Max-Age=0; Path=/; HttpOnly`;

      return new Response(
        JSON.stringify({
          user: AuthUtils.sanitizeUser(user),
          session: { id: session.id, expiresAt: session.expiresAt },
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Set-Cookie": [sessionCookie, clearStateCookie].join(", "),
          },
        }
      );
    } catch (error) {
      console.error("OAuth2 callback error:", error);
      return new Response(
        JSON.stringify({ error: "OAuth2 authentication failed" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  };
}