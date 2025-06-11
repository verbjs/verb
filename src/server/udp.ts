import { udpSocket } from "bun";

/**
 * UDP message handler
 */
export interface UDPHandler {
  /** Called when a UDP message is received */
  message?: (
    message: Buffer,
    rinfo: { address: string; port: number; family: string; size: number },
  ) => void;
  /** Called when the UDP socket is bound and ready */
  listening?: (address: { address: string; port: number; family: string }) => void;
  /** Called when an error occurs */
  error?: (error: Error) => void;
  /** Called when the socket is closed */
  close?: () => void;
}

/**
 * UDP server configuration options
 */
interface UDPServerOptions {
  /** Port to bind to (default: 3002) */
  port?: number;
  /** Hostname to bind to (default: "0.0.0.0") */
  hostname?: string;
  /** UDP message handlers */
  handlers?: UDPHandler;
  /** Socket type (default: "udp4") */
  type?: "udp4" | "udp6";
  /** Enable address reuse (default: true) */
  reuseAddr?: boolean;
}

/**
 * Creates a UDP server using Bun's native UDP socket support
 * @param options - UDP server configuration
 * @returns UDP server instance
 * @example
 * ```ts
 * const udpServer = createUDPServer({
 *   port: 3002,
 *   handlers: {
 *     message(message, rinfo) {
 *       console.log(`Received from ${rinfo.address}:${rinfo.port}:`, message.toString());
 *       // Echo back to sender
 *       udpServer.send(message, rinfo.port, rinfo.address);
 *     },
 *     listening(address) {
 *       console.log(`UDP server listening on ${address.address}:${address.port}`);
 *     }
 *   }
 * });
 * ```
 */
export const createUDPServer = (options: UDPServerOptions = {}) => {
  const {
    port = 3002,
    hostname = "0.0.0.0",
    handlers = {},
    type = "udp4",
    reuseAddr = true,
  } = options;

  const socket = udpSocket({
    type,
    reuseAddr,
  });

  // Set up event handlers
  socket.on("message", (message: Buffer, rinfo: any) => {
    handlers.message?.(message, rinfo);
  });

  socket.on("listening", () => {
    const address = socket.address();
    console.log(`UDP server listening on ${address.address}:${address.port}`);
    handlers.listening?.(address);
  });

  socket.on("error", (error: Error) => {
    console.error("UDP server error:", error);
    handlers.error?.(error);
  });

  socket.on("close", () => {
    console.log("UDP server closed");
    handlers.close?.();
  });

  // Bind the socket
  socket.bind(port, hostname);

  return {
    /** Bun UDP socket instance */
    socket,

    /** Send a message to a specific address */
    send: (
      message: string | Buffer,
      port: number,
      address: string,
      callback?: (error?: Error) => void,
    ) => {
      const buffer = typeof message === "string" ? Buffer.from(message) : message;
      socket.send(buffer, 0, buffer.length, port, address, callback);
    },

    /** Broadcast message to a subnet (basic implementation) */
    broadcast: (message: string | Buffer, port: number, subnet = "255.255.255.255") => {
      const buffer = typeof message === "string" ? Buffer.from(message) : message;
      socket.setBroadcast(true);
      socket.send(buffer, 0, buffer.length, port, subnet);
    },

    /** Get server address information */
    address: () => socket.address(),

    /** Close the server */
    close: (callback?: () => void) => {
      socket.close(callback);
    },

    /** Set socket options */
    setSocketOption: (level: number, name: number, value: Buffer | number) => {
      socket.setSocketOption(level, name, value);
    },

    /** Enable/disable broadcast */
    setBroadcast: (flag: boolean) => {
      socket.setBroadcast(flag);
    },

    /** Set TTL (Time To Live) */
    setTTL: (ttl: number) => {
      socket.setTTL(ttl);
    },

    /** Set multicast TTL */
    setMulticastTTL: (ttl: number) => {
      socket.setMulticastTTL(ttl);
    },

    /** Add membership to multicast group */
    addMembership: (multicastAddress: string, multicastInterface?: string) => {
      socket.addMembership(multicastAddress, multicastInterface);
    },

    /** Drop membership from multicast group */
    dropMembership: (multicastAddress: string, multicastInterface?: string) => {
      socket.dropMembership(multicastAddress, multicastInterface);
    },
  };
};

/**
 * UDP client for sending messages
 */
export class UDPClient {
  private socket: any;
  private type: "udp4" | "udp6";

  constructor(type: "udp4" | "udp6" = "udp4") {
    this.type = type;
    this.socket = udpSocket({ type });
  }

  /**
   * Send a message to a UDP server
   */
  send(message: string | Buffer, port: number, address: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const buffer = typeof message === "string" ? Buffer.from(message) : message;

      this.socket.send(buffer, 0, buffer.length, port, address, (error?: Error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Send and wait for response
   */
  sendAndReceive(
    message: string | Buffer,
    port: number,
    address: string,
    timeout = 5000,
  ): Promise<{ message: Buffer; rinfo: any }> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.socket.removeAllListeners("message");
        reject(new Error("UDP request timeout"));
      }, timeout);

      this.socket.once("message", (responseMessage: Buffer, rinfo: any) => {
        clearTimeout(timer);
        resolve({ message: responseMessage, rinfo });
      });

      this.socket.once("error", (error: Error) => {
        clearTimeout(timer);
        reject(error);
      });

      this.send(message, port, address).catch(reject);
    });
  }

  /**
   * Close the client socket
   */
  close(): void {
    this.socket.close();
  }
}

/**
 * Create a simple UDP echo server for testing
 */
export const createUDPEchoServer = (port = 3002) => {
  return createUDPServer({
    port,
    handlers: {
      message(message, rinfo) {
        // Echo the message back to sender
        const socket = this as any;
        socket.send(message, 0, message.length, rinfo.port, rinfo.address);
      },
    },
  });
};

/**
 * Create a UDP discovery server that responds to broadcast messages
 */
export const createDiscoveryServer = (
  port = 3002,
  serviceInfo = { name: "verb-service", version: "1.0.0" },
) => {
  return createUDPServer({
    port,
    handlers: {
      message(message, rinfo) {
        const request = message.toString();

        if (request === "DISCOVER") {
          const response = JSON.stringify({
            ...serviceInfo,
            address: rinfo.address,
            port: port,
            timestamp: Date.now(),
          });

          const socket = this as any;
          socket.send(Buffer.from(response), 0, response.length, rinfo.port, rinfo.address);
        }
      },
    },
  });
};

/**
 * UDP multicast utilities
 */
export const createMulticastGroup = (
  multicastAddress: string,
  port: number,
  handlers: UDPHandler = {},
) => {
  const server = createUDPServer({
    port,
    handlers: {
      ...handlers,
      listening(address) {
        // Join multicast group after binding
        server.addMembership(multicastAddress);
        handlers.listening?.(address);
      },
    },
  });

  return {
    ...server,
    /** Send message to multicast group */
    multicast: (message: string | Buffer) => {
      server.send(message, port, multicastAddress);
    },
  };
};
