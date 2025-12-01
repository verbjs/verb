import { createBaseServer } from "./base"

export type TlsOptions = {
  cert: string | ArrayBuffer
  key: string | ArrayBuffer
  passphrase?: string
  ca?: string | ArrayBuffer
}

export const createHttpsServer = () => {
  const server = createBaseServer()

  const withTLS = (options: TlsOptions) => {
    server._setTls(options)
    return server
  }

  return { ...server, withTLS }
}

export type HttpsServerInstance = ReturnType<typeof createHttpsServer>
