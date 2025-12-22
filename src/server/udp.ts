import type { ListenOptions } from "../types";

export interface UdpMessage {
  data: Buffer;
  remoteAddress: string;
  remotePort: number;
}

export interface UdpServerInstance {
  onMessage: (handler: (message: UdpMessage) => void) => void;
  onError: (handler: (error: Error) => void) => void;
  send: (data: Buffer | string, port: number, address: string) => void;
  listen: (port?: number, hostname?: string) => Promise<any>;
  withOptions: (options: ListenOptions) => void;
}

export const createUdpServer = (): UdpServerInstance => {
  let serverOptions: ListenOptions | null = null;
  let messageHandler: ((message: UdpMessage) => void) | null = null;
  let errorHandler: ((error: Error) => void) | null = null;

  const onMessage = (handler: (message: UdpMessage) => void) => {
    messageHandler = handler;
  };

  const onError = (handler: (error: Error) => void) => {
    errorHandler = handler;
  };

  const send = (data: Buffer | string, port: number, address: string) => {
    // In a real implementation, this would use Node.js dgram module
    console.log(`📤 UDP Send to ${address}:${port} - ${data.toString()}`);
  };

  const withOptions = (options: ListenOptions) => {
    serverOptions = options;
  };

  const listen = async (port?: number, hostname?: string) => {
    // Use stored options, or create default config
    const finalPort = port ?? serverOptions?.port ?? 3000;
    const finalHostname = hostname ?? serverOptions?.hostname ?? "localhost";

    console.log(`🚀 UDP Server listening on ${finalHostname}:${finalPort}`);

    // In a real implementation, you would use Node.js dgram module
    // const dgram = require('dgram');
    // const server = dgram.createSocket('udp4');

    // For now, we'll create a mock server
    const server = {
      port: finalPort,
      hostname: finalHostname,
      type: "udp",
      close: () => {
        console.log("🛑 UDP Server stopped");
      },
      // Simulate message handling
      _simulateMessage: (data: string, remoteAddress: string, remotePort: number) => {
        if (messageHandler) {
          messageHandler({
            data: Buffer.from(data),
            remoteAddress,
            remotePort,
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

  return {
    onMessage,
    onError,
    send,
    listen,
    withOptions,
  };
};
