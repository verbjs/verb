import type { StorageAdapter, User, Session, StorageConfig } from "../types.js";

export class PostgreSQLStorageAdapter implements StorageAdapter {
  private sql: any;
  private config: StorageConfig;

  constructor(config: StorageConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    try {
      // Dynamically import postgres
      const { default: postgres } = await import("postgres");
      if (!this.config.connectionString) {
        throw new Error("PostgreSQL connection string is required");
      }
      this.sql = postgres(this.config.connectionString, {
        ...this.config.options,
      });

      // Create tables
      await this.createTables();
    } catch (error) {
      throw new Error(`Failed to initialize PostgreSQL storage: ${error.message}`);
    }
  }

  private async createTables(): Promise<void> {
    // Users table
    await this.sql`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        username VARCHAR(100) UNIQUE,
        name VARCHAR(255),
        avatar TEXT,
        provider VARCHAR(50) NOT NULL DEFAULT 'local',
        provider_id VARCHAR(100),
        password_hash TEXT,
        email_verified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        metadata JSONB
      )
    `;

    // Sessions table
    await this.sql`
      CREATE TABLE IF NOT EXISTS sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token VARCHAR(255) UNIQUE NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        metadata JSONB
      )
    `;

    // Indexes for better performance
    await this.sql`CREATE INDEX IF NOT EXISTS idx_users_email ON users (email)`;
    await this.sql`CREATE INDEX IF NOT EXISTS idx_users_username ON users (username)`;
    await this.sql`CREATE INDEX IF NOT EXISTS idx_users_provider ON users (provider, provider_id)`;
    await this.sql`CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions (token)`;
    await this.sql`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id)`;
    await this.sql`CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at)`;

    // Trigger to update updated_at timestamp
    await this.sql`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql'
    `;

    await this.sql`
      DROP TRIGGER IF EXISTS update_users_updated_at ON users
    `;

    await this.sql`
      CREATE TRIGGER update_users_updated_at
        BEFORE UPDATE ON users
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column()
    `;
  }

  async createUser(userData: Omit<User, "id" | "createdAt" | "updatedAt">): Promise<User> {
    const [user] = await this.sql`
      INSERT INTO users (
        email, username, name, avatar, provider, provider_id,
        password_hash, email_verified, metadata
      ) VALUES (
        ${userData.email},
        ${userData.username || null},
        ${userData.name || null},
        ${userData.avatar || null},
        ${userData.provider},
        ${userData.providerId || null},
        ${userData.passwordHash || null},
        ${userData.emailVerified},
        ${userData.metadata ? JSON.stringify(userData.metadata) : null}
      )
      RETURNING *
    `;

    return this.rowToUser(user);
  }

  async getUserById(id: string): Promise<User | null> {
    const [user] = await this.sql`
      SELECT * FROM users WHERE id = ${id}
    `;

    return user ? this.rowToUser(user) : null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const [user] = await this.sql`
      SELECT * FROM users WHERE email = ${email}
    `;

    return user ? this.rowToUser(user) : null;
  }

  async getUserByUsername(username: string): Promise<User | null> {
    const [user] = await this.sql`
      SELECT * FROM users WHERE username = ${username}
    `;

    return user ? this.rowToUser(user) : null;
  }

  async getUserByProvider(provider: string, providerId: string): Promise<User | null> {
    const [user] = await this.sql`
      SELECT * FROM users WHERE provider = ${provider} AND provider_id = ${providerId}
    `;

    return user ? this.rowToUser(user) : null;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const updateData: Record<string, any> = {};

    Object.entries(updates).forEach(([key, value]) => {
      if (key === "id" || key === "createdAt" || key === "updatedAt") {
        return;
      }

      const columnName = this.camelToSnake(key);

      if (key === "metadata") {
        updateData[columnName] = value ? JSON.stringify(value) : null;
      } else if (value !== undefined) {
        updateData[columnName] = value;
      }
    });

    const _setClause = Object.keys(updateData)
      .map((key) => `${key} = $${key}`)
      .join(", ");

    const [user] = await this.sql`
      UPDATE users 
      SET ${this.sql(updateData)}
      WHERE id = ${id}
      RETURNING *
    `;

    return this.rowToUser(user);
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await this.sql`
      DELETE FROM users WHERE id = ${id}
    `;

    return result.count > 0;
  }

  async createSession(sessionData: Omit<Session, "id" | "createdAt">): Promise<Session> {
    const [session] = await this.sql`
      INSERT INTO sessions (user_id, token, expires_at, metadata)
      VALUES (
        ${sessionData.userId},
        ${sessionData.token},
        ${sessionData.expiresAt},
        ${sessionData.metadata ? JSON.stringify(sessionData.metadata) : null}
      )
      RETURNING *
    `;

    return this.rowToSession(session);
  }

  async getSession(token: string): Promise<Session | null> {
    const [session] = await this.sql`
      SELECT * FROM sessions 
      WHERE token = ${token} AND expires_at > NOW()
    `;

    return session ? this.rowToSession(session) : null;
  }

  async updateSession(id: string, updates: Partial<Session>): Promise<Session> {
    const updateData: Record<string, any> = {};

    Object.entries(updates).forEach(([key, value]) => {
      if (key === "id" || key === "createdAt") {
        return;
      }

      const columnName = this.camelToSnake(key);

      if (key === "metadata") {
        updateData[columnName] = value ? JSON.stringify(value) : null;
      } else if (value !== undefined) {
        updateData[columnName] = value;
      }
    });

    const [session] = await this.sql`
      UPDATE sessions 
      SET ${this.sql(updateData)}
      WHERE id = ${id}
      RETURNING *
    `;

    return this.rowToSession(session);
  }

  async deleteSession(id: string): Promise<boolean> {
    const result = await this.sql`
      DELETE FROM sessions WHERE id = ${id}
    `;

    return result.count > 0;
  }

  async deleteUserSessions(userId: string): Promise<number> {
    const result = await this.sql`
      DELETE FROM sessions WHERE user_id = ${userId}
    `;

    return result.count;
  }

  async cleanupExpiredSessions(): Promise<number> {
    const result = await this.sql`
      DELETE FROM sessions WHERE expires_at <= NOW()
    `;

    return result.count;
  }

  async close(): Promise<void> {
    if (this.sql) {
      await this.sql.end();
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
      emailVerified: row.email_verified,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      metadata: row.metadata || undefined,
    };
  }

  private rowToSession(row: any): Session {
    return {
      id: row.id,
      userId: row.user_id,
      token: row.token,
      expiresAt: new Date(row.expires_at),
      createdAt: new Date(row.created_at),
      metadata: row.metadata || undefined,
    };
  }

  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  }
}
