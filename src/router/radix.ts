import type { Handler, Method, Middleware } from "../types";
import type { RouteMatch } from "./types";

type ParamType = "named" | "wildcard" | "regex";

type ParamDef = {
  name: string;
  type: ParamType;
  pattern?: RegExp;
};

type RadixNode = {
  segment: string;
  handlers: Map<Method, { handler: Handler; middlewares: Middleware[] }>;
  children: Map<string, RadixNode>;
  param: ParamDef | null;
  paramChild: RadixNode | null;
  wildcardChild: RadixNode | null;
};

const createNode = (segment: string = ""): RadixNode => ({
  segment,
  handlers: new Map(),
  children: new Map(),
  param: null,
  paramChild: null,
  wildcardChild: null,
});

const parseSegment = (seg: string): { segment: string; param: ParamDef | null } => {
  if (seg.startsWith(":")) {
    const regexMatch = seg.match(/^:([^(]+)\((.+)\)$/);
    if (regexMatch?.[1] && regexMatch[2]) {
      return {
        segment: "",
        param: { name: regexMatch[1], type: "regex", pattern: new RegExp(`^${regexMatch[2]}$`) },
      };
    }
    return { segment: "", param: { name: seg.slice(1), type: "named" } };
  }
  if (seg === "*") {
    return { segment: "", param: { name: "*", type: "wildcard" } };
  }
  return { segment: seg, param: null };
};

export const createRadixRouter = () => {
  const root = createNode();
  const allRoutes: {
    method: Method;
    path: string;
    handler: Handler;
    middlewares: Middleware[];
    params: string[];
  }[] = [];

  const insert = (method: Method, path: string, middlewares: Middleware[], handler: Handler) => {
    const params: string[] = [];
    const segments = path.split("/").filter(Boolean);
    let node = root;

    for (const seg of segments) {
      const { segment, param } = parseSegment(seg);

      if (param) {
        params.push(param.name);
        if (param.type === "wildcard") {
          if (!node.wildcardChild) {
            node.wildcardChild = createNode();
            node.wildcardChild.param = param;
          }
          node = node.wildcardChild;
          break;
        }
        if (!node.paramChild) {
          node.paramChild = createNode();
          node.paramChild.param = param;
        }
        node = node.paramChild;
      } else {
        let child = node.children.get(segment);
        if (!child) {
          child = createNode(segment);
          node.children.set(segment, child);
        }
        node = child;
      }
    }

    node.handlers.set(method, { handler, middlewares });
    allRoutes.push({ method, path, handler, middlewares, params });
  };

  const find = (method: Method, path: string): RouteMatch => {
    const segments = path.split("/").filter(Boolean);
    const params: Record<string, string> = {};

    const search = (node: RadixNode, idx: number): RouteMatch => {
      if (idx === segments.length) {
        const route = node.handlers.get(method);
        if (route) {
          return { handler: route.handler, middlewares: route.middlewares, params };
        }
        return null;
      }

      const seg = segments[idx] as string;

      // static children first (fastest)
      const staticChild = node.children.get(seg);
      if (staticChild) {
        const result = search(staticChild, idx + 1);
        if (result) {
          return result;
        }
      }

      // param child
      if (node.paramChild?.param) {
        const param = node.paramChild.param;
        if (param.type === "regex" && param.pattern) {
          if (param.pattern.test(seg)) {
            params[param.name] = decodeURIComponent(seg);
            const result = search(node.paramChild, idx + 1);
            if (result) {
              return result;
            }
            delete params[param.name];
          }
        } else {
          params[param.name] = decodeURIComponent(seg);
          const result = search(node.paramChild, idx + 1);
          if (result) {
            return result;
          }
          delete params[param.name];
        }
      }

      // wildcard last
      if (node.wildcardChild) {
        const remaining = segments
          .slice(idx)
          .map((s) => decodeURIComponent(s))
          .join("/");
        params["*"] = remaining;
        const route = node.wildcardChild.handlers.get(method);
        if (route) {
          return { handler: route.handler, middlewares: route.middlewares, params };
        }
      }

      return null;
    };

    return search(root, 0);
  };

  return {
    insert,
    find,
    routes: () => allRoutes,
  };
};
