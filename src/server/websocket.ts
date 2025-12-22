import { createBaseServer, type WebSocketHandlers } from "./base";

export const createWebSocketServer = () => {
  const server = createBaseServer();

  const websocket = (handlers: WebSocketHandlers) => {
    server._setWebsocket(handlers);
    return server;
  };

  return { ...server, websocket };
};

export type WebSocketServerInstance = ReturnType<typeof createWebSocketServer>;
export type { WebSocketHandlers };
