import type { Handler, Method, Middleware } from "../types";

export type RouteMatch = {
  handler: Handler;
  middlewares: Middleware[];
  params: Record<string, string>;
} | null;

export type RouteInfo = {
  method: Method;
  path: string;
  handler: Handler;
  middlewares: Middleware[];
  params: string[];
};

export type Router = {
  add: (method: Method, path: string, middlewares: Middleware[], handler: Handler) => void;
  match: (method: Method, path: string) => RouteMatch;
  routes: () => RouteInfo[];
};
