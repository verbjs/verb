import { type ServerWebSocket, serve } from "bun";

/**
 * WebSocket connection handler
 */
export interface WebSocketHandler {
  /** Called when a WebSocket connection is opened */
  open?: (ws: ServerWebSocket<any>) => void;
  /** Called when a message is received */
  message?: (ws: ServerWebSocket<any>, message: string | Buffer) => void;
  /** Called when a WebSocket connection is closed */
  close?: (ws: ServerWebSocket<any>, code: number, reason: string) => void;
  /** Called when an error occurs */
  error?: (ws: ServerWebSocket<any>, error: Error) => void;
  /** Called when connection is being upgraded */
  upgrade?: (request: Request, server: any) => boolean | Response;
}

/**
 * WebSocket server configuration options
 */
interface WebSocketServerOptions {
  /** Port to listen on (default: 3001) */
  port?: number;
  /** Hostname to bind to (default: "0.0.0.0") */
  hostname?: string;
  /** WebSocket handlers */
  websocket?: WebSocketHandler;
  /** Maximum message size in bytes (default: 16MB) */
  maxPayloadLength?: number;
  /** Maximum number of backpressure bytes (default: 64MB) */
  backpressureLimit?: number;
  /** Close connections when backpressure limit is reached */
  closeOnBackpressureLimit?: boolean;
}

/**
 * Creates a WebSocket server using Bun's native WebSocket support
 * @param options - WebSocket server configuration
 * @returns WebSocket server instance
 * @example
 * ```ts
 * const wsServer = createWebSocketServer({
 *   port: 3001,
 *   websocket: {
 *     open(ws) {
 *       console.log("Client connected");
 *     },
 *     message(ws, message) {
 *       console.log("Received:", message);
 *       ws.send(`Echo: ${message}`);
 *     },
 *     close(ws, code, reason) {
 *       console.log("Client disconnected:", code, reason);
 *     }
 *   }
 * });
 * ```
 */
export const createWebSocketServer = (options: WebSocketServerOptions = {}) => {
  const {
    port = 3001,
    hostname = "0.0.0.0",
    websocket = {},
    maxPayloadLength = 16 * 1024 * 1024, // 16MB
    backpressureLimit = 64 * 1024 * 1024, // 64MB
    closeOnBackpressureLimit = false,
  } = options;

  const server = serve({
    port,
    hostname,
    fetch(req, server) {
      // Upgrade HTTP requests to WebSocket
      const success = server.upgrade(req, {
        data: {
          createdAt: Date.now(),
          url: req.url,
          headers: req.headers,
        },
      });

      if (success) {
        return undefined; // Connection upgraded
      }

      // Return HTTP response for non-WebSocket requests
      return new Response("WebSocket server running", {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    },
    websocket: {
      maxPayloadLength,
      backpressureLimit,
      closeOnBackpressureLimit,

      open(ws) {
        console.log(`WebSocket connection opened at ${new Date().toISOString()}`);
        websocket.open?.(ws);
      },

      message(ws, message) {
        websocket.message?.(ws, message);
      },

      close(ws, code, reason) {
        console.log(`WebSocket connection closed: ${code} ${reason}`);
        websocket.close?.(ws, code, reason);
      },

      // Note: Bun's WebSocket server does not support an 'error' handler in the websocket options.
    },
  });

  console.log(`WebSocket server running at ws://${hostname}:${port}`);

  return {
    /** Bun server instance */
    server,
    /** Broadcast message to all connected clients */
    broadcast: (message: string | Buffer) => {
      server.publish("global", message);
    },
    /** Subscribe a connection to a topic */
    subscribe: (ws: ServerWebSocket<any>, topic: string) => {
      ws.subscribe(topic);
    },
    /** Unsubscribe a connection from a topic */
    unsubscribe: (ws: ServerWebSocket<any>, topic: string) => {
      ws.unsubscribe(topic);
    },
    /** Publish message to a specific topic */
    publish: (topic: string, message: string | Buffer) => {
      server.publish(topic, message);
    },
    /** Get number of subscribers to a topic */
    getSubscriberCount: (_topic: string): number => {
      return server.pendingWebSockets;
    },
    /** Stop the server */
    stop: () => {
      server.stop();
    },
  };
};

/**
 * WebSocket client utilities for testing and development
 */
export class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private handlers: WebSocketHandler = {};

  constructor(url: string, handlers: WebSocketHandler = {}) {
    this.url = url;
    this.handlers = handlers;
  }

  /**
   * Connect to WebSocket server
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          this.handlers.open?.(this.ws as any);
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handlers.message?.(this.ws as any, event.data);
        };

        this.ws.onclose = (event) => {
          this.handlers.close?.(this.ws as any, event.code, event.reason);
        };

        this.ws.onerror = (event) => {
          // Try to extract error from event, fallback to event itself
          const err =
            (event as any).error instanceof Error
              ? (event as any).error
              : new Error("WebSocket error event");
          this.handlers.error?.(this.ws as any, err);
          reject(err);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Send message to server
   */
  send(message: string | Buffer): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(message);
    } else {
      throw new Error("WebSocket is not connected");
    }
  }

  /**
   * Close connection
   */
  close(code?: number, reason?: string): void {
    this.ws?.close(code, reason);
  }

  /**
   * Get connection state
   */
  get readyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }

  /**
   * Check if connected
   */
  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

/**
 * Create a simple WebSocket echo server for testing
 */
export const createEchoServer = (port = 3001) => {
  return createWebSocketServer({
    port,
    websocket: {
      message(ws, message) {
        ws.send(`Echo: ${message}`);
      },
    },
  });
};

/**
 * Create a WebSocket chat server with rooms
 */
export const createChatServer = (port = 3001) => {
  const _rooms = new Map<string, Set<ServerWebSocket<any>>>();

  return createWebSocketServer({
    port,
    websocket: {
      open(ws) {
        // Subscribe to general topic
        ws.subscribe("chat");
      },

      message(ws, message) {
        try {
          const data = JSON.parse(message.toString());

          switch (data.type) {
            case "join":
              ws.subscribe(data.room);
              ws.publish(
                data.room,
                JSON.stringify({
                  type: "user_joined",
                  room: data.room,
                  timestamp: Date.now(),
                }),
              );
              break;

            case "leave":
              ws.unsubscribe(data.room);
              ws.publish(
                data.room,
                JSON.stringify({
                  type: "user_left",
                  room: data.room,
                  timestamp: Date.now(),
                }),
              );
              break;

            case "message":
              ws.publish(
                data.room || "chat",
                JSON.stringify({
                  type: "message",
                  room: data.room || "chat",
                  message: data.message,
                  timestamp: Date.now(),
                }),
              );
              break;
          }
        } catch (_error) {
          ws.send(
            JSON.stringify({
              type: "error",
              message: "Invalid message format",
            }),
          );
        }
      },

      close(_ws, _code, _reason) {
        // Cleanup happens automatically when connection closes
      },
    },
  });
};
