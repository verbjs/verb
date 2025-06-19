import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync, mkdirSync } from "fs";
import { dirname } from "path";
import YAML from "yaml";
import type { StorageAdapter, User, Session, StorageConfig } from "../types.js";

interface YAMLData {
  users: User[];
  sessions: Session[];
}

export class YAMLStorageAdapter implements StorageAdapter {
  private config: StorageConfig;
  private filePath: string;
  private data: YAMLData = { users: [], sessions: [] };

  constructor(config: StorageConfig) {
    this.config = config;
    this.filePath = config.filePath || "./auth-data.yaml";
  }

  async initialize(): Promise<void> {
    try {
      // Ensure directory exists
      const dir = dirname(this.filePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      // Load existing data if file exists
      if (existsSync(this.filePath)) {
        await this.loadData();
      } else {
        // Create initial file
        await this.saveData();
      }
    } catch (error) {
      throw new Error(`Failed to initialize YAML storage: ${error.message}`);
    }
  }

  private async loadData(): Promise<void> {
    try {
      const yamlContent = await readFile(this.filePath, "utf8");
      const parsed = YAML.parse(yamlContent) || { users: [], sessions: [] };
      
      this.data = {
        users: (parsed.users || []).map(this.deserializeUser),
        sessions: (parsed.sessions || []).map(this.deserializeSession),
      };
    } catch (error) {
      console.warn(`Warning: Failed to load YAML data, starting fresh: ${error.message}`);
      this.data = { users: [], sessions: [] };
    }
  }

  private async saveData(): Promise<void> {
    try {
      const serializedData = {
        users: this.data.users.map(this.serializeUser),
        sessions: this.data.sessions.map(this.serializeSession),
      };

      const yamlContent = YAML.stringify(serializedData, {
        indent: 2,
        lineWidth: 0,
      });

      await writeFile(this.filePath, yamlContent, "utf8");
    } catch (error) {
      throw new Error(`Failed to save YAML data: ${error.message}`);
    }
  }

  private serializeUser(user: User): any {
    return {
      ...user,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  private deserializeUser(userData: any): User {
    return {
      ...userData,
      createdAt: new Date(userData.createdAt),
      updatedAt: new Date(userData.updatedAt),
    };
  }

  private serializeSession(session: Session): any {
    return {
      ...session,
      expiresAt: session.expiresAt.toISOString(),
      createdAt: session.createdAt.toISOString(),
    };
  }

  private deserializeSession(sessionData: any): Session {
    return {
      ...sessionData,
      expiresAt: new Date(sessionData.expiresAt),
      createdAt: new Date(sessionData.createdAt),
    };
  }

  async createUser(userData: Omit<User, "id" | "createdAt" | "updatedAt">): Promise<User> {
    const id = crypto.randomUUID();
    const now = new Date();

    const user: User = {
      id,
      ...userData,
      createdAt: now,
      updatedAt: now,
    };

    this.data.users.push(user);
    await this.saveData();
    return user;
  }

  async getUserById(id: string): Promise<User | null> {
    return this.data.users.find((user) => user.id === id) || null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    return this.data.users.find((user) => user.email === email) || null;
  }

  async getUserByUsername(username: string): Promise<User | null> {
    return this.data.users.find((user) => user.username === username) || null;
  }

  async getUserByProvider(provider: string, providerId: string): Promise<User | null> {
    return (
      this.data.users.find(
        (user) => user.provider === provider && user.providerId === providerId
      ) || null
    );
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const userIndex = this.data.users.findIndex((user) => user.id === id);
    if (userIndex === -1) {
      throw new Error(`User with id ${id} not found`);
    }

    const user = this.data.users[userIndex];
    const updatedUser: User = {
      ...user,
      ...updates,
      id, // Ensure ID doesn't change
      createdAt: user.createdAt, // Ensure createdAt doesn't change
      updatedAt: new Date(),
    };

    this.data.users[userIndex] = updatedUser;
    await this.saveData();
    return updatedUser;
  }

  async deleteUser(id: string): Promise<boolean> {
    const initialLength = this.data.users.length;
    this.data.users = this.data.users.filter((user) => user.id !== id);
    
    // Also delete associated sessions
    this.data.sessions = this.data.sessions.filter((session) => session.userId !== id);
    
    if (this.data.users.length < initialLength) {
      await this.saveData();
      return true;
    }
    return false;
  }

  async createSession(sessionData: Omit<Session, "id" | "createdAt">): Promise<Session> {
    const id = crypto.randomUUID();
    const now = new Date();

    const session: Session = {
      id,
      ...sessionData,
      createdAt: now,
    };

    this.data.sessions.push(session);
    await this.saveData();
    return session;
  }

  async getSession(token: string): Promise<Session | null> {
    // Clean up expired sessions first
    await this.cleanupExpiredSessions();

    return (
      this.data.sessions.find(
        (session) => session.token === token && session.expiresAt > new Date()
      ) || null
    );
  }

  async updateSession(id: string, updates: Partial<Session>): Promise<Session> {
    const sessionIndex = this.data.sessions.findIndex((session) => session.id === id);
    if (sessionIndex === -1) {
      throw new Error(`Session with id ${id} not found`);
    }

    const session = this.data.sessions[sessionIndex];
    const updatedSession: Session = {
      ...session,
      ...updates,
      id, // Ensure ID doesn't change
      createdAt: session.createdAt, // Ensure createdAt doesn't change
    };

    this.data.sessions[sessionIndex] = updatedSession;
    await this.saveData();
    return updatedSession;
  }

  async deleteSession(id: string): Promise<boolean> {
    const initialLength = this.data.sessions.length;
    this.data.sessions = this.data.sessions.filter((session) => session.id !== id);
    
    if (this.data.sessions.length < initialLength) {
      await this.saveData();
      return true;
    }
    return false;
  }

  async deleteUserSessions(userId: string): Promise<number> {
    const initialLength = this.data.sessions.length;
    this.data.sessions = this.data.sessions.filter((session) => session.userId !== userId);
    
    const deletedCount = initialLength - this.data.sessions.length;
    if (deletedCount > 0) {
      await this.saveData();
    }
    return deletedCount;
  }

  async cleanupExpiredSessions(): Promise<number> {
    const now = new Date();
    const initialLength = this.data.sessions.length;
    
    this.data.sessions = this.data.sessions.filter(
      (session) => session.expiresAt > now
    );
    
    const deletedCount = initialLength - this.data.sessions.length;
    if (deletedCount > 0) {
      await this.saveData();
    }
    return deletedCount;
  }

  async close(): Promise<void> {
    // Save any pending changes
    await this.saveData();
  }
}