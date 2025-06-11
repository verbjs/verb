/**
 * Session Management System
 * Provides session stores (memory, Redis), cookie handling, and session security
 * Refactored to use functional programming patterns
 */

import { createHash, randomBytes } from "node:crypto";

/**
 * Session data interface
 */
export interface SessionData {
  [key: string]: any;
}

/**
 * Session information
 */
export interface Session {
  id: string;
  data: SessionData;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  isNew: boolean;
}

/**
 * Session store interface
 */
export interface SessionStore {
  get(sessionId: string): Promise<Session | null>;
  set(sessionId: string, session: Session): Promise<void>;
  destroy(sessionId: string): Promise<void>;
  touch(sessionId: string): Promise<void>;
  clear(): Promise<void>;
  length(): Promise<number>;
}

/**
 * Cookie options for session management
 */
export interface SessionCookieOptions {
  name?: string;
  maxAge?: number;
  expires?: Date;
  path?: string;
  domain?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: "strict" | "lax" | "none";
  signed?: boolean;
}

/**
 * Session configuration options
 */
export interface SessionOptions {
  store?: SessionStore;
  cookie?: SessionCookieOptions;
  secret?: string;
  genid?: () => string;
  resave?: boolean;
  saveUninitialized?: boolean;
  rolling?: boolean;
  name?: string;
}

/**
 * Memory session store state
 */
interface MemorySessionStoreState {
  readonly sessions: Map<string, Session>;
  readonly timers: Map<string, NodeJS.Timeout>;
}

/**
 * Create memory session store state
 */
const createMemorySessionStoreState = (): MemorySessionStoreState => ({
  sessions: new Map<string, Session>(),
  timers: new Map<string, NodeJS.Timeout>(),
});

/**
 * Memory store get function
 */
const memoryStoreGet = (
  state: MemorySessionStoreState,
  sessionId: string,
): Promise<Session | null> => {
  const session = state.sessions.get(sessionId);
  if (!session) {
    return Promise.resolve(null);
  }

  // Check if session is expired
  if (session.expiresAt < new Date()) {
    memoryStoreDestroy(state, sessionId);
    return Promise.resolve(null);
  }

  return Promise.resolve({ ...session, isNew: false });
};

/**
 * Memory store set function
 */
const memoryStoreSet = (
  state: MemorySessionStoreState,
  sessionId: string,
  session: Session,
): Promise<void> => {
  state.sessions.set(sessionId, { ...session });

  // Clear existing timer
  const existingTimer = state.timers.get(sessionId);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  // Set new expiration timer
  const ttl = session.expiresAt.getTime() - Date.now();
  if (ttl > 0) {
    const timer = setTimeout(() => {
      memoryStoreDestroy(state, sessionId);
    }, ttl);
    state.timers.set(sessionId, timer);
  }

  return Promise.resolve();
};

/**
 * Memory store destroy function
 */
const memoryStoreDestroy = (state: MemorySessionStoreState, sessionId: string): Promise<void> => {
  state.sessions.delete(sessionId);

  const timer = state.timers.get(sessionId);
  if (timer) {
    clearTimeout(timer);
    state.timers.delete(sessionId);
  }

  return Promise.resolve();
};

/**
 * Memory store touch function
 */
const memoryStoreTouch = (state: MemorySessionStoreState, sessionId: string): Promise<void> => {
  const session = state.sessions.get(sessionId);
  if (session) {
    session.updatedAt = new Date();
    return memoryStoreSet(state, sessionId, session);
  }
  return Promise.resolve();
};

/**
 * Memory store clear function
 */
const memoryStoreClear = (state: MemorySessionStoreState): Promise<void> => {
  // Clear all timers
  for (const timer of state.timers.values()) {
    clearTimeout(timer);
  }

  state.sessions.clear();
  state.timers.clear();
  return Promise.resolve();
};

/**
 * Memory store length function
 */
const memoryStoreLength = (state: MemorySessionStoreState): Promise<number> => {
  return Promise.resolve(state.sessions.size);
};

/**
 * Create memory session store
 */
export const createMemorySessionStore = (): SessionStore => {
  const state = createMemorySessionStoreState();

  return {
    get: (sessionId: string) => memoryStoreGet(state, sessionId),
    set: (sessionId: string, session: Session) => memoryStoreSet(state, sessionId, session),
    destroy: (sessionId: string) => memoryStoreDestroy(state, sessionId),
    touch: (sessionId: string) => memoryStoreTouch(state, sessionId),
    clear: () => memoryStoreClear(state),
    length: () => memoryStoreLength(state),
  };
};

/**
 * Redis session store state
 */
interface RedisSessionStoreState {
  readonly client: any;
  readonly prefix: string;
  readonly ttl: number;
}

/**
 * Create Redis session store state
 */
const createRedisSessionStoreState = (
  redisClient: any,
  options: { prefix?: string; ttl?: number } = {},
): RedisSessionStoreState => ({
  client: redisClient,
  prefix: options.prefix || "sess:",
  ttl: options.ttl || 86400, // 24 hours default
});

/**
 * Get Redis key
 */
const getRedisKey = (state: RedisSessionStoreState, sessionId: string): string => {
  return `${state.prefix}${sessionId}`;
};

/**
 * Redis store get function
 */
const redisStoreGet = async (
  state: RedisSessionStoreState,
  sessionId: string,
): Promise<Session | null> => {
  try {
    const data = await state.client.get(getRedisKey(state, sessionId));
    if (!data) {
      return null;
    }

    const session = JSON.parse(data);
    session.createdAt = new Date(session.createdAt);
    session.updatedAt = new Date(session.updatedAt);
    session.expiresAt = new Date(session.expiresAt);

    // Check if session is expired
    if (session.expiresAt < new Date()) {
      await redisStoreDestroy(state, sessionId);
      return null;
    }

    return { ...session, isNew: false };
  } catch (error) {
    console.error("Redis session get error:", error);
    return null;
  }
};

/**
 * Redis store set function
 */
const redisStoreSet = async (
  state: RedisSessionStoreState,
  sessionId: string,
  session: Session,
): Promise<void> => {
  try {
    const key = getRedisKey(state, sessionId);
    const serialized = JSON.stringify(session);
    const ttl = Math.ceil((session.expiresAt.getTime() - Date.now()) / 1000);

    if (ttl > 0) {
      await state.client.setex(key, ttl, serialized);
    }
  } catch (error) {
    console.error("Redis session set error:", error);
  }
};

/**
 * Redis store destroy function
 */
const redisStoreDestroy = async (
  state: RedisSessionStoreState,
  sessionId: string,
): Promise<void> => {
  try {
    await state.client.del(getRedisKey(state, sessionId));
  } catch (error) {
    console.error("Redis session destroy error:", error);
  }
};

/**
 * Redis store touch function
 */
const redisStoreTouch = async (state: RedisSessionStoreState, sessionId: string): Promise<void> => {
  try {
    const session = await redisStoreGet(state, sessionId);
    if (session) {
      session.updatedAt = new Date();
      await redisStoreSet(state, sessionId, session);
    }
  } catch (error) {
    console.error("Redis session touch error:", error);
  }
};

/**
 * Redis store clear function
 */
const redisStoreClear = async (state: RedisSessionStoreState): Promise<void> => {
  try {
    const keys = await state.client.keys(`${state.prefix}*`);
    if (keys.length > 0) {
      await state.client.del(keys);
    }
  } catch (error) {
    console.error("Redis session clear error:", error);
  }
};

/**
 * Redis store length function
 */
const redisStoreLength = async (state: RedisSessionStoreState): Promise<number> => {
  try {
    const keys = await state.client.keys(`${state.prefix}*`);
    return keys.length;
  } catch (error) {
    console.error("Redis session length error:", error);
    return 0;
  }
};

/**
 * Create Redis session store
 */
export const createRedisSessionStore = (
  redisClient: any,
  options: { prefix?: string; ttl?: number } = {},
): SessionStore => {
  const state = createRedisSessionStoreState(redisClient, options);

  return {
    get: (sessionId: string) => redisStoreGet(state, sessionId),
    set: (sessionId: string, session: Session) => redisStoreSet(state, sessionId, session),
    destroy: (sessionId: string) => redisStoreDestroy(state, sessionId),
    touch: (sessionId: string) => redisStoreTouch(state, sessionId),
    clear: () => redisStoreClear(state),
    length: () => redisStoreLength(state),
  };
};

/**
 * Generate a secure session ID
 */
export function generateSessionId(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Sign a value using HMAC
 */
export function sign(value: string, secret: string): string {
  const signature = createHash("sha256")
    .update(value + secret)
    .digest("base64")
    .replace(/=/g, "");
  return `${value}.${signature}`;
}

/**
 * Unsign a signed value
 */
export function unsign(signedValue: string, secret: string): string | false {
  const lastDotIndex = signedValue.lastIndexOf(".");
  if (lastDotIndex === -1) {
    return false;
  }

  const value = signedValue.slice(0, lastDotIndex);
  const signature = signedValue.slice(lastDotIndex + 1);

  const expected = createHash("sha256")
    .update(value + secret)
    .digest("base64")
    .replace(/=/g, "");

  return signature === expected ? value : false;
}

/**
 * Parse cookies from request header
 */
export function parseCookies(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) {
    return {};
  }

  const cookies: Record<string, string> = {};

  for (const cookie of cookieHeader.split(";")) {
    const [name, ...rest] = cookie.trim().split("=");
    if (name && rest.length > 0) {
      cookies[name] = decodeURIComponent(rest.join("="));
    }
  }

  return cookies;
}

/**
 * Serialize cookie for Set-Cookie header
 */
export function serializeCookie(
  name: string,
  value: string,
  options: SessionCookieOptions = {},
): string {
  let cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;

  if (options.maxAge !== undefined) {
    cookie += `; Max-Age=${Math.floor(options.maxAge)}`;
  }

  if (options.expires) {
    cookie += `; Expires=${options.expires.toUTCString()}`;
  }

  if (options.path) {
    cookie += `; Path=${options.path}`;
  }

  if (options.domain) {
    cookie += `; Domain=${options.domain}`;
  }

  if (options.secure) {
    cookie += "; Secure";
  }

  if (options.httpOnly) {
    cookie += "; HttpOnly";
  }

  if (options.sameSite) {
    cookie += `; SameSite=${options.sameSite}`;
  }

  return cookie;
}

/**
 * Session manager state
 */
export interface SessionManagerState {
  readonly store: SessionStore;
  readonly options: Required<SessionOptions>;
}

/**
 * Create session manager state
 */
export const createSessionManagerState = (options: SessionOptions = {}): SessionManagerState => {
  const store = options.store || createMemorySessionStore();

  return {
    store,
    options: {
      store,
      cookie: {
        name: "sessionId",
        maxAge: 86400000, // 24 hours
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        signed: true,
        ...options.cookie,
      },
      secret: options.secret || "default-session-secret",
      genid: options.genid || generateSessionId,
      resave: options.resave ?? false,
      saveUninitialized: options.saveUninitialized ?? true,
      rolling: options.rolling ?? false,
      name: options.name || "sessionId",
    },
  };
};

/**
 * Create session middleware
 */
export const createSessionMiddleware = (state: SessionManagerState) => {
  return async (req: Request, next: () => Response | Promise<Response>): Promise<Response> => {
    const cookies = parseCookies(req.headers.get("Cookie"));
    let sessionId = cookies[state.options.cookie.name || "sessionId"];

    // Unsign session ID if signed cookies are enabled
    if (sessionId && state.options.cookie.signed) {
      const unsigned = unsign(sessionId, state.options.secret);
      sessionId = unsigned || "";
    }

    let session: Session | null = null;
    let isNewSession = false;

    // Try to load existing session
    if (sessionId) {
      session = await state.store.get(sessionId);
    }

    // Create new session if none exists
    if (!session) {
      sessionId = state.options.genid();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + (state.options.cookie.maxAge || 86400000));

      session = {
        id: sessionId,
        data: {},
        createdAt: now,
        updatedAt: now,
        expiresAt,
        isNew: true,
      };
      isNewSession = true;
    }

    // Store original data for comparison
    const originalData = JSON.stringify(session.data);

    // Attach session to request
    (req as any).session = session;

    // Execute next middleware/handler
    const response = await next();

    // Check if session data was modified
    const dataModified = JSON.stringify(session.data) !== originalData;

    // Save session if needed
    const shouldSave =
      (isNewSession && state.options.saveUninitialized) ||
      (!isNewSession && (state.options.resave || dataModified)) ||
      state.options.rolling;

    if (shouldSave) {
      if (state.options.rolling) {
        session.expiresAt = new Date(Date.now() + (state.options.cookie.maxAge || 86400000));
      }
      session.updatedAt = new Date();
      await state.store.set(sessionId, session);
    }

    // Set session cookie
    let cookieValue = sessionId;
    if (state.options.cookie.signed) {
      cookieValue = sign(sessionId, state.options.secret);
    }

    const cookie = serializeCookie(state.options.cookie.name || "sessionId", cookieValue, {
      ...state.options.cookie,
      expires: session.expiresAt,
    });

    response.headers.set("Set-Cookie", cookie);

    return response;
  };
};

/**
 * Create session middleware with options
 */
export function session(options: SessionOptions = {}) {
  const state = createSessionManagerState(options);
  return createSessionMiddleware(state);
}

/**
 * Get session from request
 */
export function getSession(req: Request): Session | null {
  return (req as any).session || null;
}

/**
 * Set session data
 */
export function setSessionData(req: Request, key: string, value: any): void {
  const session = getSession(req);
  if (session) {
    session.data[key] = value;
  }
}

/**
 * Get session data
 */
export function getSessionData(req: Request, key: string): any {
  const session = getSession(req);
  return session?.data[key];
}

/**
 * Clear session data
 */
export function clearSessionData(req: Request): void {
  const session = getSession(req);
  if (session) {
    session.data = {};
  }
}

/**
 * Destroy session
 */
export function destroySession(req: Request): void {
  const session = getSession(req);
  if (session) {
    (req as any).session = null;
  }
}

// Legacy class-based exports for backward compatibility
export class MemorySessionStore implements SessionStore {
  private store: SessionStore;

  constructor() {
    this.store = createMemorySessionStore();
  }

  async get(sessionId: string): Promise<Session | null> {
    return this.store.get(sessionId);
  }

  async set(sessionId: string, session: Session): Promise<void> {
    return this.store.set(sessionId, session);
  }

  async destroy(sessionId: string): Promise<void> {
    return this.store.destroy(sessionId);
  }

  async touch(sessionId: string): Promise<void> {
    return this.store.touch(sessionId);
  }

  async clear(): Promise<void> {
    return this.store.clear();
  }

  async length(): Promise<number> {
    return this.store.length();
  }
}

export class RedisSessionStore implements SessionStore {
  private store: SessionStore;

  constructor(redisClient: any, options: { prefix?: string; ttl?: number } = {}) {
    this.store = createRedisSessionStore(redisClient, options);
  }

  async get(sessionId: string): Promise<Session | null> {
    return this.store.get(sessionId);
  }

  async set(sessionId: string, session: Session): Promise<void> {
    return this.store.set(sessionId, session);
  }

  async destroy(sessionId: string): Promise<void> {
    return this.store.destroy(sessionId);
  }

  async touch(sessionId: string): Promise<void> {
    return this.store.touch(sessionId);
  }

  async clear(): Promise<void> {
    return this.store.clear();
  }

  async length(): Promise<number> {
    return this.store.length();
  }
}

export class SessionManager {
  private state: SessionManagerState;
  private options: SessionOptions;

  constructor(options: SessionOptions = {}) {
    this.options = options;
    this.state = createSessionManagerState(options);
  }

  middleware() {
    return createSessionMiddleware(this.state);
  }

  getStore(): SessionStore {
    // Return a MemorySessionStore instance for backward compatibility
    if (!this.options?.store) {
      return new MemorySessionStore();
    }
    return this.state.store;
  }

  async destroySession(sessionId: string): Promise<void> {
    await this.state.store.destroy(sessionId);
  }
}
