import type { ListenOptions } from "../types";

// Bun-specific types
type BunFile = any;

export interface DtlsMessage {
  data: Buffer;
  remoteAddress: string;
  remotePort: number;
  encrypted: boolean;
  authorized: boolean;
}

export type DtlsOptions = {
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

export interface DtlsServerInstance {
  onMessage: (handler: (message: DtlsMessage) => void) => void;
  onError: (handler: (error: Error) => void) => void;
  send: (data: Buffer | string, port: number, address: string) => void;
  listen: (port?: number, hostname?: string) => Promise<any>;
  withOptions: (options: ListenOptions) => void;
  withTLS: (options: DtlsOptions) => DtlsServerInstance;
}

export const createDtlsServer = (): DtlsServerInstance => {
  let serverOptions: ListenOptions | null = null;
  let tlsOptions: DtlsOptions | null = null;
  let messageHandler: ((message: DtlsMessage) => void) | null = null;
  let errorHandler: ((error: Error) => void) | null = null;

  const onMessage = (handler: (message: DtlsMessage) => void) => {
    messageHandler = handler;
  };

  const onError = (handler: (error: Error) => void) => {
    errorHandler = handler;
  };

  const send = (data: Buffer | string, port: number, address: string) => {
    // In a real implementation, this would use Node.js dgram module with DTLS
    console.log(`📤 DTLS Send to ${address}:${port} - ${data.toString()}`);
  };

  const withOptions = (options: ListenOptions) => {
    serverOptions = options;
  };

  const withTLS = (options: DtlsOptions): DtlsServerInstance => {
    tlsOptions = options;
    return dtlsServer;
  };

  const listen = async (port?: number, hostname?: string) => {
    if (!tlsOptions) {
      throw new Error("DTLS server requires TLS options. Use withTLS() to configure.");
    }

    // Use stored options, or create default config
    const finalPort = port ?? serverOptions?.port ?? 3000;
    const finalHostname = hostname ?? serverOptions?.hostname ?? "localhost";

    console.log(`🚀 DTLS Server listening on ${finalHostname}:${finalPort}`);

    // In a real implementation, you would use Node.js dgram module with DTLS
    // const dgram = require('dgram');
    // const server = dgram.createSocket('udp4');
    // server.bind(port, hostname);
    
    // For now, we'll create a mock server
    const server = {
      port: finalPort,
      hostname: finalHostname,
      type: 'dtls',
      tlsOptions,
      close: () => {
        console.log("🛑 DTLS Server stopped");
      },
      // Simulate message handling
      _simulateMessage: (data: string, remoteAddress: string, remotePort: number) => {
        if (messageHandler) {
          messageHandler({
            data: Buffer.from(data),
            remoteAddress,
            remotePort,
            encrypted: true,
            authorized: true,
          });
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

  const dtlsServer: DtlsServerInstance = {
    onMessage,
    onError,
    send,
    listen,
    withOptions,
    withTLS,
  };

  return dtlsServer;
};