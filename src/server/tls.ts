import type { ListenOptions } from "../types";

export interface TlsConnection {
  id: string;
  remoteAddress: string;
  remotePort: number;
  write: (data: string | Buffer) => void;
  end: () => void;
  destroy: () => void;
  encrypted: boolean;
  authorized: boolean;
  getPeerCertificate: () => any;
}

export type TlsOptions = {
  cert: string | ArrayBuffer | BunFile;
  key: string | ArrayBuffer | BunFile;
  passphrase?: string;
  ca?: string | ArrayBuffer | BunFile;
  dhParamsFile?: string;
  lowMemoryMode?: boolean;
  secureOptions?: number;
  requestCert?: boolean;
  rejectUnauthorized?: boolean;
};

export interface TlsServerInstance {
  onConnection: (handler: (connection: TlsConnection) => void) => void;
  onData: (handler: (connection: TlsConnection, data: Buffer) => void) => void;
  onClose: (handler: (connection: TlsConnection) => void) => void;
  onError: (handler: (error: Error) => void) => void;
  listen: (port?: number, hostname?: string) => Promise<any>;
  withOptions: (options: ListenOptions) => void;
  withTLS: (options: TlsOptions) => TlsServerInstance;
}

export const createTlsServer = (): TlsServerInstance => {
  let serverOptions: ListenOptions | null = null;
  let tlsOptions: TlsOptions | null = null;
  let connectionHandler: ((connection: TlsConnection) => void) | null = null;
  let dataHandler: ((connection: TlsConnection, data: Buffer) => void) | null = null;
  let closeHandler: ((connection: TlsConnection) => void) | null = null;
  let errorHandler: ((error: Error) => void) | null = null;

  const onConnection = (handler: (connection: TlsConnection) => void) => {
    connectionHandler = handler;
  };

  const onData = (handler: (connection: TlsConnection, data: Buffer) => void) => {
    dataHandler = handler;
  };

  const onClose = (handler: (connection: TlsConnection) => void) => {
    closeHandler = handler;
  };

  const onError = (handler: (error: Error) => void) => {
    errorHandler = handler;
  };

  const withOptions = (options: ListenOptions) => {
    serverOptions = options;
  };

  const withTLS = (options: TlsOptions): TlsServerInstance => {
    tlsOptions = options;
    return tlsServer;
  };

  const createMockConnection = (id: string, remoteAddress: string, remotePort: number): TlsConnection => {
    const connection: TlsConnection = {
      id,
      remoteAddress,
      remotePort,
      encrypted: true,
      authorized: true,
      write: (data: string | Buffer) => {
        console.log(`📤 TLS Send to ${remoteAddress}:${remotePort} - ${data.toString()}`);
      },
      end: () => {
        console.log(`🔌 TLS Connection ${id} ended gracefully`);
        if (closeHandler) {
          closeHandler(connection);
        }
      },
      destroy: () => {
        console.log(`💥 TLS Connection ${id} destroyed`);
        if (closeHandler) {
          closeHandler(connection);
        }
      },
      getPeerCertificate: () => {
        return {
          subject: { CN: 'localhost' },
          issuer: { CN: 'localhost' },
          valid_from: new Date().toISOString(),
          valid_to: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          fingerprint: 'AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD'
        };
      }
    };
    return connection;
  };

  const listen = async (port?: number, hostname?: string) => {
    if (!tlsOptions) {
      throw new Error("TLS server requires TLS options. Use withTLS() to configure.");
    }

    // Use stored options, or create default config
    const finalPort = port ?? serverOptions?.port ?? 3000;
    const finalHostname = hostname ?? serverOptions?.hostname ?? "localhost";

    console.log(`🚀 TLS Server listening on ${finalHostname}:${finalPort}`);

    // In a real implementation, you would use Node.js tls module
    // const tls = require('tls');
    // const server = tls.createServer(tlsOptions, (socket) => { ... });
    
    // For now, we'll create a mock server
    const server = {
      port: finalPort,
      hostname: finalHostname,
      type: 'tls',
      connections: new Map<string, TlsConnection>(),
      tlsOptions,
      close: () => {
        console.log("🛑 TLS Server stopped");
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

  const tlsServer: TlsServerInstance = {
    onConnection,
    onData,
    onClose,
    onError,
    listen,
    withOptions,
    withTLS,
  };

  return tlsServer;
};