import type { ListenOptions } from "../types";

export interface TcpConnection {
  id: string;
  remoteAddress: string;
  remotePort: number;
  write: (data: string | Buffer) => void;
  end: () => void;
  destroy: () => void;
}

export interface TcpServerInstance {
  onConnection: (handler: (connection: TcpConnection) => void) => void;
  onData: (handler: (connection: TcpConnection, data: Buffer) => void) => void;
  onClose: (handler: (connection: TcpConnection) => void) => void;
  onError: (handler: (error: Error) => void) => void;
  listen: (port?: number, hostname?: string) => Promise<any>;
  withOptions: (options: ListenOptions) => void;
}

export const createTcpServer = (): TcpServerInstance => {
  let serverOptions: ListenOptions | null = null;
  let connectionHandler: ((connection: TcpConnection) => void) | null = null;
  let dataHandler: ((connection: TcpConnection, data: Buffer) => void) | null = null;
  let closeHandler: ((connection: TcpConnection) => void) | null = null;
  let errorHandler: ((error: Error) => void) | null = null;

  const onConnection = (handler: (connection: TcpConnection) => void) => {
    connectionHandler = handler;
  };

  const onData = (handler: (connection: TcpConnection, data: Buffer) => void) => {
    dataHandler = handler;
  };

  const onClose = (handler: (connection: TcpConnection) => void) => {
    closeHandler = handler;
  };

  const onError = (handler: (error: Error) => void) => {
    errorHandler = handler;
  };

  const withOptions = (options: ListenOptions) => {
    serverOptions = options;
  };

  const createMockConnection = (
    id: string,
    remoteAddress: string,
    remotePort: number,
  ): TcpConnection => {
    const connection: TcpConnection = {
      id,
      remoteAddress,
      remotePort,
      write: (data: string | Buffer) => {
        console.log(`📤 TCP Send to ${remoteAddress}:${remotePort} - ${data.toString()}`);
      },
      end: () => {
        console.log(`🔌 TCP Connection ${id} ended gracefully`);
        if (closeHandler) {
          closeHandler(connection);
        }
      },
      destroy: () => {
        console.log(`💥 TCP Connection ${id} destroyed`);
        if (closeHandler) {
          closeHandler(connection);
        }
      },
    };
    return connection;
  };

  const listen = async (port?: number, hostname?: string) => {
    // Use stored options, or create default config
    const finalPort = port ?? serverOptions?.port ?? 3000;
    const finalHostname = hostname ?? serverOptions?.hostname ?? "localhost";

    console.log(`🚀 TCP Server listening on ${finalHostname}:${finalPort}`);

    // In a real implementation, you would use Node.js net module
    // const net = require('net');
    // const server = net.createServer((socket) => { ... });

    // For now, we'll create a mock server
    const server = {
      port: finalPort,
      hostname: finalHostname,
      type: "tcp",
      connections: new Map<string, TcpConnection>(),
      close: () => {
        console.log("🛑 TCP Server stopped");
      },
      // Simulate connection handling
      _simulateConnection: (remoteAddress: string, remotePort: number) => {
        const connectionId = `${remoteAddress}:${remotePort}-${Date.now()}`;
        const connection = createMockConnection(connectionId, remoteAddress, remotePort);

        server.connections.set(connectionId, connection);

        if (connectionHandler) {
          connectionHandler(connection);
        }

        return connection;
      },
      // Simulate data handling
      _simulateData: (connectionId: string, data: string) => {
        const connection = server.connections.get(connectionId);
        if (connection && dataHandler) {
          dataHandler(connection, Buffer.from(data));
        }
      },
      // Simulate error handling
      _simulateError: (error: Error) => {
        if (errorHandler) {
          errorHandler(error);
        }
      },
    };

    return server;
  };

  return {
    onConnection,
    onData,
    onClose,
    onError,
    listen,
    withOptions,
  };
};
