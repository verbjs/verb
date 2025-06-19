import type { StorageAdapter, User, Session, StorageConfig } from "../types.js";

export class SQLiteStorageAdapter implements StorageAdapter {
  private db: any;
  private config: StorageConfig;

  constructor(config: StorageConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    try {
      // Dynamically import better-sqlite3
      const { default: Database } = await import("better-sqlite3");
      this.db = new Database(this.config.database || ":memory:");

      // Create tables
      this.createTables();
    } catch (error) {
      throw new Error(`Failed to initialize SQLite storage: ${error.message}`);
    }
  }

  private createTables(): void {
    // Users table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        username TEXT UNIQUE,
        name TEXT,
        avatar TEXT,
        provider TEXT NOT NULL DEFAULT 'local',
        provider_id TEXT,
        password_hash TEXT,
        email_verified BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        metadata TEXT
      )
    `);

    // Sessions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token TEXT UNIQUE NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        metadata TEXT,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `);

    // Indexes for better performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
      CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);
      CREATE INDEX IF NOT EXISTS idx_users_provider ON users (provider, provider_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions (token);
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at);
    `);
  }

  async createUser(userData: Omit<User, "id" | "createdAt" | "updatedAt">): Promise<User> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO users (
        id, email, username, name, avatar, provider, provider_id,
        password_hash, email_verified, created_at, updated_at, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run([
      id,
      userData.email,
      userData.username || null,
      userData.name || null,
      userData.avatar || null,
      userData.provider,
      userData.providerId || null,
      userData.passwordHash || null,
      userData.emailVerified ? 1 : 0,
      now,
      now,
      userData.metadata ? JSON.stringify(userData.metadata) : null,
    ]);

    return this.getUserById(id)!;
  }

  async getUserById(id: string): Promise<User | null> {
    const stmt = this.db.prepare("SELECT * FROM users WHERE id = ?");
    const row = stmt.get(id);
    return row ? this.rowToUser(row) : null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const stmt = this.db.prepare("SELECT * FROM users WHERE email = ?");
    const row = stmt.get(email);
    return row ? this.rowToUser(row) : null;
  }

  async getUserByUsername(username: string): Promise<User | null> {
    const stmt = this.db.prepare("SELECT * FROM users WHERE username = ?");
    const row = stmt.get(username);
    return row ? this.rowToUser(row) : null;
  }

  async getUserByProvider(provider: string, providerId: string): Promise<User | null> {
    const stmt = this.db.prepare("SELECT * FROM users WHERE provider = ? AND provider_id = ?");
    const row = stmt.get(provider, providerId);
    return row ? this.rowToUser(row) : null;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const updateFields: string[] = [];
    const updateValues: any[] = [];

    Object.entries(updates).forEach(([key, value]) => {
      if (key === "id" || key === "createdAt") return;

      const columnName = this.camelToSnake(key);
      
      if (key === "emailVerified") {
        updateFields.push(`${columnName} = ?`);
        updateValues.push(value ? 1 : 0);
      } else if (key === "metadata") {
        updateFields.push(`${columnName} = ?`);
        updateValues.push(value ? JSON.stringify(value) : null);
      } else if (value !== undefined) {
        updateFields.push(`${columnName} = ?`);
        updateValues.push(value);
      }
    });

    updateFields.push("updated_at = ?");
    updateValues.push(new Date().toISOString());
    updateValues.push(id);

    const stmt = this.db.prepare(`
      UPDATE users SET ${updateFields.join(", ")} WHERE id = ?
    `);

    stmt.run(updateValues);
    return this.getUserById(id)!;
  }

  async deleteUser(id: string): Promise<boolean> {
    const stmt = this.db.prepare("DELETE FROM users WHERE id = ?");
    const result = stmt.run(id);
    return result.changes > 0;
  }

  async createSession(sessionData: Omit<Session, "id" | "createdAt">): Promise<Session> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO sessions (id, user_id, token, expires_at, created_at, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run([
      id,
      sessionData.userId,
      sessionData.token,
      sessionData.expiresAt.toISOString(),
      now,
      sessionData.metadata ? JSON.stringify(sessionData.metadata) : null,
    ]);

    return this.getSessionById(id)!;
  }

  async getSession(token: string): Promise<Session | null> {
    const stmt = this.db.prepare("SELECT * FROM sessions WHERE token = ? AND expires_at > CURRENT_TIMESTAMP");
    const row = stmt.get(token);
    return row ? this.rowToSession(row) : null;
  }

  private async getSessionById(id: string): Promise<Session | null> {
    const stmt = this.db.prepare("SELECT * FROM sessions WHERE id = ?");
    const row = stmt.get(id);
    return row ? this.rowToSession(row) : null;
  }

  async updateSession(id: string, updates: Partial<Session>): Promise<Session> {
    const updateFields: string[] = [];
    const updateValues: any[] = [];

    Object.entries(updates).forEach(([key, value]) => {
      if (key === "id" || key === "createdAt") return;

      const columnName = this.camelToSnake(key);
      
      if (key === "expiresAt") {
        updateFields.push(`${columnName} = ?`);
        updateValues.push((value as Date).toISOString());
      } else if (key === "metadata") {
        updateFields.push(`${columnName} = ?`);
        updateValues.push(value ? JSON.stringify(value) : null);
      } else if (value !== undefined) {
        updateFields.push(`${columnName} = ?`);
        updateValues.push(value);
      }
    });

    updateValues.push(id);

    const stmt = this.db.prepare(`
      UPDATE sessions SET ${updateFields.join(", ")} WHERE id = ?
    `);

    stmt.run(updateValues);
    return this.getSessionById(id)!;
  }

  async deleteSession(id: string): Promise<boolean> {
    const stmt = this.db.prepare("DELETE FROM sessions WHERE id = ?");
    const result = stmt.run(id);
    return result.changes > 0;
  }

  async deleteUserSessions(userId: string): Promise<number> {
    const stmt = this.db.prepare("DELETE FROM sessions WHERE user_id = ?");
    const result = stmt.run(userId);
    return result.changes;
  }

  async cleanupExpiredSessions(): Promise<number> {
    const stmt = this.db.prepare("DELETE FROM sessions WHERE expires_at <= CURRENT_TIMESTAMP");
    const result = stmt.run();
    return result.changes;
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
    }
  }

  private rowToUser(row: any): User {
    return {
      id: row.id,
      email: row.email,
      username: row.username || undefined,
      name: row.name || undefined,
      avatar: row.avatar || undefined,
      provider: row.provider,
      providerId: row.provider_id || undefined,
      passwordHash: row.password_hash || undefined,
      emailVerified: Boolean(row.email_verified),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
  }

  private rowToSession(row: any): Session {
    return {
      id: row.id,
      userId: row.user_id,
      token: row.token,
      expiresAt: new Date(row.expires_at),
      createdAt: new Date(row.created_at),
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
  }

  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  }
}