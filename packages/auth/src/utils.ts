import { randomBytes } from "node:crypto";

export class AuthUtils {
  /**
   * Hash a password using Bun's built-in password hashing
   */
  static async hashPassword(password: string): Promise<string> {
    return await Bun.password.hash(password);
  }

  /**
   * Verify a password against a hash
   */
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return await Bun.password.verify(password, hash);
  }

  /**
   * Generate a secure random token
   */
  static generateToken(length = 32): string {
    return randomBytes(length).toString("hex");
  }

  /**
   * Generate a JWT token using native crypto
   */
  static async generateJWT(
    payload: any,
    secret: string,
    options: { expiresIn?: string; algorithm?: string } = {}
  ): Promise<string> {
    const defaultOptions = {
      expiresIn: "24h",
      algorithm: "HS256",
    };
    const mergedOptions = { ...defaultOptions, ...options };

    // Create header and payload
    const header = {
      typ: "JWT",
      alg: mergedOptions.algorithm,
    };

    const now = Math.floor(Date.now() / 1000);
    const exp = mergedOptions.expiresIn === "24h" ? now + 24 * 60 * 60 : now + 3600;

    const jwtPayload = {
      ...payload,
      iat: now,
      exp,
    };

    // Base64url encode
    const encode = (obj: any) => 
      btoa(JSON.stringify(obj))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

    const encodedHeader = encode(header);
    const encodedPayload = encode(jwtPayload);
    const signingInput = `${encodedHeader}.${encodedPayload}`;

    // Sign with HMAC SHA256
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signingInput));
    const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    return `${signingInput}.${encodedSignature}`;
  }

  /**
   * Verify and decode a JWT token using native crypto
   */
  static async verifyJWT(token: string, secret: string): Promise<any> {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format');
      }

      const [encodedHeader, encodedPayload, encodedSignature] = parts;

      // Decode base64url
      const decode = (str: string) => {
        const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
        const pad = base64.length % 4;
        const padded = pad ? base64 + '='.repeat(4 - pad) : base64;
        return JSON.parse(atob(padded));
      };

      const header = decode(encodedHeader);
      const payload = decode(encodedPayload);

      // Verify signature
      const signingInput = `${encodedHeader}.${encodedPayload}`;
      const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['verify']
      );

      const signature = Uint8Array.from(atob(encodedSignature.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
      const isValid = await crypto.subtle.verify('HMAC', key, signature, new TextEncoder().encode(signingInput));

      if (!isValid) {
        throw new Error('Invalid signature');
      }

      // Check expiration
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < now) {
        throw new Error('Token expired');
      }

      return payload;
    } catch (error) {
      throw new Error(`Invalid JWT token: ${error.message}`);
    }
  }

  /**
   * Validate email format
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate password strength
   */
  static validatePassword(password: string, requirements?: {
    minLength?: number;
    requireUppercase?: boolean;
    requireLowercase?: boolean;
    requireNumbers?: boolean;
    requireSymbols?: boolean;
  }): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const config = {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSymbols: false,
      ...requirements,
    };

    if (password.length < config.minLength) {
      errors.push(`Password must be at least ${config.minLength} characters long`);
    }

    if (config.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push("Password must contain at least one uppercase letter");
    }

    if (config.requireLowercase && !/[a-z]/.test(password)) {
      errors.push("Password must contain at least one lowercase letter");
    }

    if (config.requireNumbers && !/\d/.test(password)) {
      errors.push("Password must contain at least one number");
    }

    if (config.requireSymbols && !/[^a-zA-Z0-9]/.test(password)) {
      errors.push("Password must contain at least one symbol");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Generate a secure session cookie
   */
  static generateSessionCookie(
    name: string,
    value: string,
    options: {
      maxAge?: number;
      secure?: boolean;
      httpOnly?: boolean;
      sameSite?: "strict" | "lax" | "none";
      domain?: string;
      path?: string;
    } = {}
  ): string {
    const cookieOptions = {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      secure: true,
      httpOnly: true,
      sameSite: "lax" as const,
      path: "/",
      ...options,
    };

    const cookieParts = [`${name}=${value}`];

    if (cookieOptions.maxAge) {
      cookieParts.push(`Max-Age=${Math.floor(cookieOptions.maxAge / 1000)}`);
    }

    if (cookieOptions.secure) {
      cookieParts.push("Secure");
    }

    if (cookieOptions.httpOnly) {
      cookieParts.push("HttpOnly");
    }

    if (cookieOptions.sameSite) {
      cookieParts.push(`SameSite=${cookieOptions.sameSite}`);
    }

    if (cookieOptions.domain) {
      cookieParts.push(`Domain=${cookieOptions.domain}`);
    }

    if (cookieOptions.path) {
      cookieParts.push(`Path=${cookieOptions.path}`);
    }

    return cookieParts.join("; ");
  }

  /**
   * Parse cookies from request headers
   */
  static parseCookies(cookieHeader?: string): Record<string, string> {
    if (!cookieHeader) { return {}; }

    return cookieHeader
      .split(";")
      .reduce((cookies, cookie) => {
        const [name, value] = cookie.trim().split("=");
        if (name && value) {
          cookies[name] = decodeURIComponent(value);
        }
        return cookies;
      }, {} as Record<string, string>);
  }

  /**
   * Create a consistent user ID from provider info
   */
  static createProviderId(provider: string, id: string): string {
    return `${provider}:${id}`;
  }

  /**
   * Sanitize user data for responses
   */
  static sanitizeUser(user: any): any {
    const { passwordHash, ...sanitized } = user;
    return sanitized;
  }

  /**
   * Generate a random state parameter for OAuth2
   */
  static generateOAuth2State(): string {
    return AuthUtils.generateToken(16);
  }

  /**
   * Build OAuth2 authorization URL
   */
  static buildOAuth2Url(
    authUrl: string,
    clientId: string,
    redirectUri: string,
    scope: string[] = [],
    state?: string
  ): string {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: scope.join(" "),
    });

    if (state) {
      params.append("state", state);
    }

    return `${authUrl}?${params.toString()}`;
  }

  /**
   * Exchange OAuth2 authorization code for access token
   */
  static async exchangeOAuth2Code(
    tokenUrl: string,
    clientId: string,
    clientSecret: string,
    code: string,
    redirectUri: string
  ): Promise<any> {
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }).toString(),
    });

    if (!response.ok) {
      throw new Error(`OAuth2 token exchange failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Fetch user info from OAuth2 provider
   */
  static async fetchOAuth2UserInfo(
    userInfoUrl: string,
    accessToken: string
  ): Promise<any> {
    const response = await fetch(userInfoUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch user info: ${response.statusText}`);
    }

    return response.json();
  }
}