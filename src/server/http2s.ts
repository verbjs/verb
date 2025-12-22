import { createBaseServer } from "./base";

export type TlsOptions = {
  cert: string | ArrayBuffer;
  key: string | ArrayBuffer;
  passphrase?: string;
  ca?: string | ArrayBuffer;
};

export const createHttp2sServer = () => {
  const server = createBaseServer({ http2: true });

  const withTLS = (options: TlsOptions) => {
    server._setTls(options);
    return server;
  };

  return { ...server, withTLS };
};

export type Http2sServerInstance = ReturnType<typeof createHttp2sServer>;
