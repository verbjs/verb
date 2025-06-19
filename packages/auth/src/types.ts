export interface User {
  id: string;
  email: string;
  username?: string;
  name?: string;
  avatar?: string;
  provider: "local" | "google" | "github" | "discord" | string;
  providerId?: string;
  passwordHash?: string;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

export interface Session {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
  metadata?: Record<string, any>;
}

export interface OAuth2Provider {
  name: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope?: string[];
  authUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
}

export interface OAuth2Config {
  [providerName: string]: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    scope?: string[];
  };
}

export interface StorageConfig {
  type: "sqlite" | "postgresql" | "yaml";
  database?: string;
  connectionString?: string;
  filePath?: string;
  options?: Record<string, any>;
}

export interface SessionConfig {
  secret: string;
  maxAge: number;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: "strict" | "lax" | "none";
  cookieName?: string;
}

export interface AuthConfig {
  storage: StorageConfig;
  session: SessionConfig;
  providers?: OAuth2Config;
  jwt?: {
    secret: string;
    expiresIn?: string;
    algorithm?: string;
  };
  password?: {
    minLength?: number;
    requireUppercase?: boolean;
    requireLowercase?: boolean;
    requireNumbers?: boolean;
    requireSymbols?: boolean;
  };
  registration?: {
    enabled?: boolean;
    requireEmailVerification?: boolean;
    allowedDomains?: string[];
  };
}

export interface AuthRequest extends Request {
  user?: User;
  session?: Session;
}

export interface LoginCredentials {
  email?: string;
  username?: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  username?: string;
  password: string;
  name?: string;
}

export interface OAuth2Token {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
}

export interface OAuth2UserInfo {
  id: string;
  email: string;
  name?: string;
  username?: string;
  avatar?: string;
  verified?: boolean;
}

export interface StorageAdapter {
  // User operations
  createUser(user: Omit<User, "id" | "createdAt" | "updatedAt">): Promise<User>;
  getUserById(id: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  getUserByUsername(username: string): Promise<User | null>;
  getUserByProvider(provider: string, providerId: string): Promise<User | null>;
  updateUser(id: string, updates: Partial<User>): Promise<User>;
  deleteUser(id: string): Promise<boolean>;
  
  // Session operations
  createSession(session: Omit<Session, "id" | "createdAt">): Promise<Session>;
  getSession(token: string): Promise<Session | null>;
  updateSession(id: string, updates: Partial<Session>): Promise<Session>;
  deleteSession(id: string): Promise<boolean>;
  deleteUserSessions(userId: string): Promise<number>;
  cleanupExpiredSessions(): Promise<number>;
  
  // Lifecycle
  initialize(): Promise<void>;
  close(): Promise<void>;
}

export interface AuthMiddleware {
  requireAuth: (req: AuthRequest) => Promise<Response | void>;
  optionalAuth: (req: AuthRequest) => Promise<void>;
}

export interface AuthHandlers {
  login: (req: Request) => Promise<Response>;
  register: (req: Request) => Promise<Response>;
  logout: (req: Request) => Promise<Response>;
  me: (req: AuthRequest) => Promise<Response>;
  oauth2: (provider: string) => (req: Request) => Promise<Response>;
  oauth2Callback: (provider: string) => (req: Request) => Promise<Response>;
}

export interface AuthPlugin {
  config: AuthConfig;
  storage: StorageAdapter;
  middleware: AuthMiddleware;
  handlers: AuthHandlers;
  
  // Utility methods
  hashPassword: (password: string) => Promise<string>;
  verifyPassword: (password: string, hash: string) => Promise<boolean>;
  generateToken: () => string;
  generateJWT: (payload: any) => string;
  verifyJWT: (token: string) => any;
}