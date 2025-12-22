import { createBaseServer, type WebSocketHandlers } from "./base";

export type TlsOptions = {
  cert: string | ArrayBuffer;
  key: string | ArrayBuffer;
  passphrase?: string;
  ca?: string | ArrayBuffer;
};

export const createWebSocketsServer = () => {
  const server = createBaseServer();

  const websocket = (handlers: WebSocketHandlers) => {
    server._setWebsocket(handlers);
    return server;
  };

  const withTLS = (options: TlsOptions) => {
    server._setTls(options);
    return server;
  };

  return { ...server, websocket, withTLS };
};

export type WebSocketsServerInstance = ReturnType<typeof createWebSocketsServer>;
export type { WebSocketHandlers };
