import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { randomBytes } from "crypto";

export class AuthUtils {
  /**
   * Hash a password using bcrypt
   */
  static async hashPassword(password: string, saltRounds = 12): Promise<string> {
    return bcrypt.hash(password, saltRounds);
  }

  /**
   * Verify a password against a hash
   */
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate a secure random token
   */
  static generateToken(length = 32): string {
    return randomBytes(length).toString("hex");
  }

  /**
   * Generate a JWT token
   */
  static generateJWT(
    payload: any,
    secret: string,
    options: jwt.SignOptions = {}
  ): string {
    const defaultOptions: jwt.SignOptions = {
      expiresIn: "24h",
      algorithm: "HS256",
    };

    return jwt.sign(payload, secret, { ...defaultOptions, ...options });
  }

  /**
   * Verify and decode a JWT token
   */
  static verifyJWT(token: string, secret: string): any {
    try {
      return jwt.verify(token, secret);
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
    if (!cookieHeader) return {};

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
    return this.generateToken(16);
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