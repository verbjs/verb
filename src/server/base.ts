import { enhanceRequest } from "../request"
import { createResponse } from "../response"
import { createRouter } from "../router"
import type {
  Handler,
  ListenOptions,
  Method,
  Middleware,
  MiddlewareHandler,
  Request,
  Response,
  RouteConfig,
} from "../types"
import { parseFormData } from "../upload"
import { parseQuery } from "../utils"

export type WebSocketHandlers = {
  open?: (ws: any, req?: any) => void
  message?: (ws: any, message: string | Buffer) => void
  close?: (ws: any, code?: number, reason?: string) => void
  error?: (ws: any, error: Error) => void
}

export type BaseServerConfig = {
  tls?: {
    cert: string | ArrayBuffer
    key: string | ArrayBuffer
    passphrase?: string
    ca?: string | ArrayBuffer
  }
  http2?: boolean
  websocket?: WebSocketHandlers
}

export const createBaseServer = (config: BaseServerConfig = {}) => {
  const router = createRouter()
  const globalMiddlewares: Middleware[] = []
  const pathMiddlewares = new Map<string, Middleware[]>()
  let htmlRoutes: RouteConfig | null = null
  let serverOptions: ListenOptions | null = null

  const settings = new Map<string, any>()
  const locals: Record<string, any> = {}
  const mountpath = "/"

  const env = process.env.VERB_ENV || process.env.BUN_ENV || process.env.NODE_ENV || "development"
  settings.set("env", env)
  settings.set("trust proxy", env === "production")
  settings.set("view cache", env === "production")

  const path = () => mountpath

  const use = (pathOrMiddleware: string | Middleware, ...middlewares: Middleware[]) => {
    if (typeof pathOrMiddleware === "string") {
      const path = pathOrMiddleware
      const existing = pathMiddlewares.get(path) || []
      pathMiddlewares.set(path, [...existing, ...middlewares])
    } else {
      globalMiddlewares.push(pathOrMiddleware)
    }
  }

  const withRoutes = (routes: RouteConfig) => {
    htmlRoutes = routes
  }

  const withOptions = (options: ListenOptions) => {
    serverOptions = options
  }

  const set = (key: string, value: any) => settings.set(key, value)
  const getSetting = (key: string) => settings.get(key)

  const parseHandlers = (...handlers: MiddlewareHandler[]): { middlewares: Middleware[]; handler: Handler } => {
    const handler = handlers[handlers.length - 1] as Handler
    const middlewares = handlers.slice(0, -1) as Middleware[]
    return { middlewares, handler }
  }

  const addRoute = (method: Method, path: string | string[], handlers: MiddlewareHandler[]) => {
    const { middlewares, handler } = parseHandlers(...handlers)
    const paths = Array.isArray(path) ? path : [path]
    paths.forEach(p => router.add(method, p, middlewares, handler))
  }

  const get = (path: string | string[], ...handlers: MiddlewareHandler[]) => addRoute("GET", path, handlers)
  const post = (path: string | string[], ...handlers: MiddlewareHandler[]) => addRoute("POST", path, handlers)
  const put = (path: string | string[], ...handlers: MiddlewareHandler[]) => addRoute("PUT", path, handlers)
  const del = (path: string | string[], ...handlers: MiddlewareHandler[]) => addRoute("DELETE", path, handlers)
  const patch = (path: string | string[], ...handlers: MiddlewareHandler[]) => addRoute("PATCH", path, handlers)
  const head = (path: string | string[], ...handlers: MiddlewareHandler[]) => addRoute("HEAD", path, handlers)
  const options = (path: string | string[], ...handlers: MiddlewareHandler[]) => addRoute("OPTIONS", path, handlers)

  const route = (path: string) => ({
    get: (...h: MiddlewareHandler[]) => { addRoute("GET", path, h); return route(path) },
    post: (...h: MiddlewareHandler[]) => { addRoute("POST", path, h); return route(path) },
    put: (...h: MiddlewareHandler[]) => { addRoute("PUT", path, h); return route(path) },
    delete: (...h: MiddlewareHandler[]) => { addRoute("DELETE", path, h); return route(path) },
    patch: (...h: MiddlewareHandler[]) => { addRoute("PATCH", path, h); return route(path) },
    head: (...h: MiddlewareHandler[]) => { addRoute("HEAD", path, h); return route(path) },
    options: (...h: MiddlewareHandler[]) => { addRoute("OPTIONS", path, h); return route(path) },
    all: (...h: MiddlewareHandler[]) => {
      const methods: Method[] = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"]
      methods.forEach(m => addRoute(m, path, h))
      return route(path)
    },
  })

  const runMiddlewares = async (middlewares: Middleware[], req: Request, res: Response): Promise<boolean> => {
    for (const mw of middlewares) {
      let called = false
      await mw(req, res, () => { called = true })
      if (!called) return false
    }
    return true
  }

  const createFetchHandler = () => async (req: Request): Promise<Response> => {
    const method = req.method as Method
    const extendedReq = enhanceRequest(req)
    extendedReq.query = parseQuery(req.url)

    if (req.headers.get("content-type")?.includes("multipart/form-data")) {
      (extendedReq as any).formData = () => parseFormData(req)
    }

    const path = extendedReq.path || "/"

    try {
      const { res, getResponse } = createResponse()

      if (!(await runMiddlewares(globalMiddlewares, extendedReq, res))) {
        return await getResponse()
      }

      for (const [mwPath, middlewares] of pathMiddlewares) {
        if (path === mwPath || path.startsWith(`${mwPath}/`)) {
          if (!(await runMiddlewares(middlewares, extendedReq, res))) {
            return await getResponse()
          }
        }
      }

      const match = router.match(method, path)
      if (!match) {
        return new Response("Not Found", { status: 404 })
      }

      extendedReq.params = match.params

      if (!(await runMiddlewares(match.middlewares, extendedReq, res))) {
        return await getResponse()
      }

      await match.handler(extendedReq, res)
      return await getResponse()
    } catch (error) {
      console.error("Handler error:", error)
      return new Response("Internal Server Error", { status: 500 })
    }
  }

  const listen = (port?: number, hostname?: string) => {
    const finalPort = port ?? serverOptions?.port ?? 3000
    const finalHostname = hostname ?? serverOptions?.hostname ?? "localhost"

    const bunConfig: any = {
      port: finalPort,
      hostname: finalHostname,
    }

    if (config.tls) {
      bunConfig.tls = config.tls
    }

    if (config.http2) {
      bunConfig.h2 = true
    }

    if (config.websocket) {
      bunConfig.websocket = {
        open: config.websocket.open || (() => {}),
        message: config.websocket.message || (() => {}),
        close: config.websocket.close || (() => {}),
        error: config.websocket.error || (() => {}),
      }
      // WebSocket upgrade handling
      const baseFetch = createFetchHandler()
      bunConfig.fetch = (req: Request, server: any) => {
        if (req.headers.get("upgrade") === "websocket") {
          const success = server.upgrade(req, { data: { url: req.url } })
          if (success) return
          return new Response("WebSocket upgrade failed", { status: 400 })
        }
        return baseFetch(req)
      }
    } else if (htmlRoutes) {
      bunConfig.routes = htmlRoutes
    } else {
      bunConfig.fetch = createFetchHandler()
    }

    if (serverOptions?.development) {
      bunConfig.development = serverOptions.development
    }

    return Bun.serve(bunConfig)
  }

  return {
    get,
    post,
    put,
    delete: del,
    patch,
    head,
    options,
    use,
    route,
    withRoutes,
    withOptions,
    listen,
    createFetchHandler,
    router,
    set,
    getSetting,
    locals,
    mountpath,
    path,
    // Allow protocol servers to modify config
    _setTls: (tls: BaseServerConfig["tls"]) => { config.tls = tls },
    _setHttp2: (enabled: boolean) => { config.http2 = enabled },
    _setWebsocket: (handlers: WebSocketHandlers) => { config.websocket = handlers },
  }
}
