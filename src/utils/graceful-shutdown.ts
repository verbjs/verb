/**
 * Graceful shutdown utilities for Verb applications
 */

export interface ShutdownHandler {
  name: string;
  handler: () => Promise<void>;
  timeout?: number;
}

export class GracefulShutdown {
  private handlers: ShutdownHandler[] = [];
  private isShuttingDown = false;
  private shutdownPromise: Promise<void> | null = null;

  constructor(
    private logger?: { info: (msg: string) => void; error: (msg: string, error?: Error) => void },
  ) {
    this.setupSignalHandlers();
  }

  /**
   * Add a shutdown handler
   */
  addHandler(handler: ShutdownHandler) {
    if (this.isShuttingDown) {
      throw new Error("Cannot add handlers during shutdown");
    }
    this.handlers.push(handler);
  }

  /**
   * Start graceful shutdown process
   */
  async shutdown(signal?: string): Promise<void> {
    if (this.shutdownPromise) {
      return this.shutdownPromise;
    }

    this.shutdownPromise = this._performShutdown(signal);
    return this.shutdownPromise;
  }

  private async _performShutdown(signal = "manual"): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    this.log(`Starting graceful shutdown (signal: ${signal})`);

    const startTime = Date.now();

    try {
      // Execute shutdown handlers in reverse order (LIFO)
      const handlersToRun = [...this.handlers].reverse();

      for (const handler of handlersToRun) {
        this.log(`Running shutdown handler: ${handler.name}`);

        try {
          const timeout = handler.timeout || 10000;
          await Promise.race([
            handler.handler(),
            this.createTimeout(timeout, `Handler "${handler.name}" timed out`),
          ]);

          this.log(`Shutdown handler "${handler.name}" completed`);
        } catch (error) {
          this.logError(`Error in shutdown handler "${handler.name}"`, error as Error);
        }
      }

      const duration = Date.now() - startTime;
      this.log(`Graceful shutdown completed in ${duration}ms`);
    } catch (error) {
      this.logError("Error during shutdown", error as Error);
      throw error;
    }
  }

  private setupSignalHandlers() {
    const signals = ["SIGTERM", "SIGINT"] as const;

    signals.forEach((signal) => {
      process.on(signal, () => {
        this.shutdown(signal)
          .then(() => {
            process.exit(0);
          })
          .catch((error) => {
            this.logError("Shutdown failed", error);
            process.exit(1);
          });
      });
    });

    // Handle uncaught exceptions and unhandled rejections
    process.on("uncaughtException", (error) => {
      this.logError("Uncaught exception", error);
      this.shutdown("uncaughtException")
        .then(() => {
          process.exit(1);
        })
        .catch(() => {
          process.exit(1);
        });
    });

    process.on("unhandledRejection", (reason) => {
      this.logError("Unhandled rejection", new Error(String(reason)));
      this.shutdown("unhandledRejection")
        .then(() => {
          process.exit(1);
        })
        .catch(() => {
          process.exit(1);
        });
    });
  }

  private createTimeout(ms: number, message: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    });
  }

  private log(message: string) {
    if (this.logger) {
      this.logger.info(message);
    } else {
      console.log(`[GracefulShutdown] ${message}`);
    }
  }

  private logError(message: string, error?: Error) {
    if (this.logger) {
      this.logger.error(message, error);
    } else {
      console.error(`[GracefulShutdown] ${message}`, error);
    }
  }

  /**
   * Check if shutdown is in progress
   */
  get shuttingDown(): boolean {
    return this.isShuttingDown;
  }
}

/**
 * Connection tracker for managing active connections during shutdown
 */
export class ConnectionTracker {
  private connections = new Set<any>();
  private isShuttingDown = false;

  add(connection: any) {
    if (this.isShuttingDown) {
      // Reject new connections during shutdown
      if (connection.destroy) {
        connection.destroy();
      } else if (connection.close) {
        connection.close();
      }
      return;
    }

    this.connections.add(connection);

    // Remove connection when it closes
    const cleanup = () => {
      this.connections.delete(connection);
    };

    if (connection.on) {
      connection.on("close", cleanup);
      connection.on("end", cleanup);
      connection.on("error", cleanup);
    }
  }

  async shutdown(timeoutMs = 10000): Promise<void> {
    this.isShuttingDown = true;

    if (this.connections.size === 0) {
      return;
    }

    console.log(`Waiting for ${this.connections.size} connections to close...`);

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.log(`Timeout reached, forcefully closing ${this.connections.size} connections`);
        this.connections.forEach((conn) => {
          try {
            if (conn.destroy) {
              conn.destroy();
            } else if (conn.close) {
              conn.close();
            }
          } catch (_error) {
            // Ignore errors during force close
          }
        });
        this.connections.clear();
        resolve();
      }, timeoutMs);

      const checkConnections = () => {
        if (this.connections.size === 0) {
          clearTimeout(timeout);
          resolve();
        } else {
          setTimeout(checkConnections, 100);
        }
      };

      checkConnections();
    });
  }

  get count(): number {
    return this.connections.size;
  }

  get shuttingDown(): boolean {
    return this.isShuttingDown;
  }
}

// Global instances
export const gracefulShutdown = new GracefulShutdown();
export const connectionTracker = new ConnectionTracker();
