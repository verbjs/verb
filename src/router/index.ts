import type { Handler, Method, Middleware } from "../types"
import type { Router, RouteMatch, RouteInfo } from "./types"
import { createRadixRouter } from "./radix"

export type { Router, RouteMatch, RouteInfo }

export const createRouter = (): Router => {
  const staticRoutes = new Map<string, { handler: Handler; middlewares: Middleware[] }>()
  const radix = createRadixRouter()

  const isDynamic = (path: string): boolean =>
    path.includes(":") || path.includes("*")

  const add = (method: Method, path: string, middlewares: Middleware[], handler: Handler) => {
    if (isDynamic(path)) {
      radix.insert(method, path, middlewares, handler)
    } else {
      // static routes use direct map lookup - O(1)
      staticRoutes.set(`${method}:${path}`, { handler, middlewares })
      // also store in radix for routes() listing
      radix.insert(method, path, middlewares, handler)
    }
  }

  const match = (method: Method, path: string): RouteMatch => {
    // static lookup first - O(1)
    const key = `${method}:${path}`
    const staticRoute = staticRoutes.get(key)
    if (staticRoute) {
      return { handler: staticRoute.handler, middlewares: staticRoute.middlewares, params: {} }
    }

    // trailing slash normalization
    if (path.length > 1 && path.endsWith("/")) {
      const trimmedKey = `${method}:${path.slice(0, -1)}`
      const trimmed = staticRoutes.get(trimmedKey)
      if (trimmed) {
        return { handler: trimmed.handler, middlewares: trimmed.middlewares, params: {} }
      }
    }

    // radix tree for dynamic routes - O(path length)
    return radix.find(method, path)
  }

  const routes = (): RouteInfo[] => radix.routes()

  return { add, match, routes }
}
