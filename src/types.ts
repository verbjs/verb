export type Method = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS";

export enum ServerProtocol {
  HTTP = "http",
  HTTPS = "https",
  HTTP2 = "http2",
  HTTP2S = "http2s",
  WEBSOCKET = "websocket",
  WEBSOCKETS = "websockets",
  GRPC = "grpc",
  GRPCS = "grpcs",
  UDP = "udp",
  DTLS = "dtls",
  TCP = "tcp",
  TLS = "tls",
}

export type VerbRequest = globalThis.Request & {
  params?: Record<string, string>;
  query?: Record<string, string>;
  body?: any;
  _bodyParsed?: boolean;
  formData?: () => Promise<{ fields: Record<string, string>; files: Record<string, any> }>;
  cookies?: Record<string, string>;
  ip?: string;
  path?: string;
  hostname?: string;
  protocol?: string;
  secure?: boolean;
  xhr?: boolean;
  get?: (header: string) => string | undefined;
  accepts?: (types?: string | string[]) => string | string[] | null;
  acceptsCharsets?: (charsets?: string | string[]) => string | string[] | null;
  acceptsEncodings?: (encodings?: string | string[]) => string | string[] | null;
  acceptsLanguages?: (languages?: string | string[]) => string | string[] | null;
};

export type VerbResponse = {
  send: (data: string | object | number | boolean) => VerbResponse;
  json: (data: any) => VerbResponse;
  status: (code: number) => VerbResponse;
  redirect: (url: string, code?: number) => VerbResponse;
  html: (content: string) => VerbResponse;
  text: (content: string) => VerbResponse;
  react: (component: any, props?: any) => VerbResponse;
  header: (name: string, value: string) => VerbResponse;
  headers: (headers: Record<string, string>) => VerbResponse;
  cookie: (name: string, value: string, options?: any) => VerbResponse;
  clearCookie: (name: string) => VerbResponse;
  type: (contentType: string) => VerbResponse;
  attachment: (filename?: string) => VerbResponse;
  download: (path: string, filename?: string, options?: any) => Promise<VerbResponse>;
  sendFile: (path: string, options?: any) => Promise<VerbResponse>;
  vary: (header: string) => VerbResponse;
  end: () => VerbResponse;
};

// Clean exports without "Verb" prefix
export type Request = VerbRequest;
export type Response = VerbResponse;

export type Handler = (
  req: VerbRequest,
  res: VerbResponse,
) => void | Promise<void> | VerbResponse | Promise<VerbResponse>;

export type Middleware = (
  req: VerbRequest,
  res: VerbResponse,
  next: () => void,
) => void | Promise<void>;

export type ErrorHandler = (
  err: Error,
  req: VerbRequest,
  res: VerbResponse,
  next: () => void,
) => void | Promise<void>;

export type MiddlewareHandler = Middleware | Handler | ErrorHandler;

export type Route = {
  method: Method;
  path: string;
  handler: Handler;
  params?: string[];
};

export type DevelopmentOptions = {
  hmr?: boolean;
  console?: boolean;
};

export type ListenOptions = {
  port?: number;
  hostname?: string;
  development?: DevelopmentOptions;
  showRoutes?: boolean;
};

// Bun routes format types
export type BunRouteHandler = (
  req: globalThis.Request,
) => globalThis.Response | Promise<globalThis.Response>;

export type BunRouteMethodHandlers = {
  [method in Method]?: BunRouteHandler;
} & {
  [method: string]: BunRouteHandler; // Allow custom HTTP methods
};

export type BunRouteValue =
  | globalThis.Response // Direct response
  | BunRouteHandler // Single handler function
  | BunRouteMethodHandlers // Object with HTTP methods
  | any; // HTMLBundle or other Bun-specific types

export type RouteConfig = {
  [path: string]: BunRouteValue;
};

export type ServerInstance = {
  get: (path: string | string[], ...handlers: MiddlewareHandler[]) => void;
  post: (path: string | string[], ...handlers: MiddlewareHandler[]) => void;
  put: (path: string | string[], ...handlers: MiddlewareHandler[]) => void;
  delete: (path: string | string[], ...handlers: MiddlewareHandler[]) => void;
  patch: (path: string | string[], ...handlers: MiddlewareHandler[]) => void;
  head: (path: string | string[], ...handlers: MiddlewareHandler[]) => void;
  options: (path: string | string[], ...handlers: MiddlewareHandler[]) => void;
  use: (pathOrMiddleware: string | Middleware, ...middlewares: Middleware[]) => void;
  route: (path: string) => any; // Route instance
  withRoutes: (routes: RouteConfig) => void;
  withOptions: (options: ListenOptions) => void;
  listen: (port?: number, hostname?: string) => any;
  createFetchHandler: () => (req: globalThis.Request) => Promise<globalThis.Response>;
  // Application configuration
  set: (key: string, value: any) => void;
  getSetting: (key: string) => any;
  locals: Record<string, any>;
  mountpath: string;
  path: () => string;
};
