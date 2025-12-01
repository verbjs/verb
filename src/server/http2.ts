import { createBaseServer } from "./base"

export const createHttp2Server = () => createBaseServer({ http2: true })
