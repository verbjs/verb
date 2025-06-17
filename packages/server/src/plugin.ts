import type { Handler, Middleware, Router } from "./types.ts";

/**
 * Plugin lifecycle hooks
 */
export interface PluginHooks {
  /** Called before the plugin is registered */
  beforeRegister?: (context: PluginContext) => void | Promise<void>;
  /** Called after the plugin is registered */
  afterRegister?: (context: PluginContext) => void | Promise<void>;
  /** Called before the server starts */
  beforeStart?: (context: PluginContext) => void | Promise<void>;
  /** Called after the server starts */
  afterStart?: (context: PluginContext) => void | Promise<void>;
  /** Called before the server stops */
  beforeStop?: (context: PluginContext) => void | Promise<void>;
  /** Called after the server stops */
  afterStop?: (context: PluginContext) => void | Promise<void>;
}

/**
 * Plugin metadata and configuration
 */
export interface PluginMetadata {
  /** Unique plugin identifier */
  name: string;
  /** Plugin version */
  version: string;
  /** Plugin description */
  description?: string;
  /** Plugin author */
  author?: string;
  /** Plugin dependencies (other plugin names) */
  dependencies?: string[];
  /** Plugin tags for categorization */
  tags?: string[];
  /** Plugin configuration schema */
  configSchema?: any;
}

/**
 * Plugin context provided during lifecycle hooks
 */
export interface PluginContext {
  /** Plugin metadata */
  plugin: PluginMetadata;
  /** Server instance */
  server: any;
  /** Router instance */
  router: Router;
  /** Plugin configuration */
  config: any;
  /** Logger scoped to this plugin */
  log: (message: string, level?: string) => void;
  /** Add a route to the server */
  addRoute: (method: string, path: string, handler: Handler) => void;
  /** Add middleware to the server */
  addMiddleware: (middleware: Middleware) => void;
  /** Register a service that other plugins can use */
  registerService: (name: string, service: any) => void;
  /** Get a service registered by another plugin */
  getService: (name: string) => any;
  /** Plugin-scoped storage */
  storage: Map<string, any>;
}

/**
 * Main plugin interface
 */
export interface Plugin {
  /** Plugin metadata */
  metadata: PluginMetadata;
  /** Plugin lifecycle hooks */
  hooks?: PluginHooks;
  /** Plugin registration function */
  register: (context: PluginContext) => void | Promise<void>;
  /** Plugin configuration */
  config?: any;
}

/**
 * Plugin registration options
 */
export interface PluginRegistrationOptions {
  /** Plugin configuration override */
  config?: any;
  /** Plugin prefix for routes */
  prefix?: string;
  /** Plugin scoping options */
  scope?: {
    /** Isolate plugin routes */
    isolateRoutes?: boolean;
    /** Isolate plugin middleware */
    isolateMiddleware?: boolean;
  };
}

/**
 * Plugin manager state
 */
export interface PluginManagerState {
  readonly plugins: Map<string, Plugin>;
  readonly pluginContexts: Map<string, PluginContext>;
  readonly services: Map<string, any>;
  readonly registrationOrder: string[];
  readonly isStarted: boolean;
  readonly server: any;
  readonly router: Router;
}

/**
 * Create plugin manager state
 */
export const createPluginManager = (server: any, router: Router): PluginManagerState => ({
  plugins: new Map<string, Plugin>(),
  pluginContexts: new Map<string, PluginContext>(),
  services: new Map<string, any>(),
  registrationOrder: [],
  isStarted: false,
  server,
  router,
});

/**
 * Update server in plugin manager state
 */
export const updateServer = (state: PluginManagerState, server: any): PluginManagerState => ({
  ...state,
  server,
});

/**
 * Create plugin context
 */
const createPluginContext = (
  plugin: PluginMetadata,
  server: any,
  router: Router,
  services: Map<string, any>,
  config: any,
  options?: PluginRegistrationOptions,
): PluginContext => ({
  plugin,
  server,
  router,
  config,
  log: (message: string, _level = "info") => {
    console.log(`[${plugin.name}] ${message}`);
  },
  addRoute: (method: string, path: string, handler: Handler) => {
    if (!server) {
      console.warn(`[${plugin.name}] Cannot add route - no server context available`);
      return;
    }
    const fullPath = options?.prefix ? `${options.prefix}${path}` : path;
    const methodLower = method.toLowerCase();
    if (typeof server[methodLower] === "function") {
      server[methodLower](fullPath, handler);
    } else {
      console.warn(`[${plugin.name}] Server method ${methodLower} not available`);
    }
  },
  addMiddleware: (middleware: Middleware) => {
    if (!server) {
      console.warn(`[${plugin.name}] Cannot add middleware - no server context available`);
      return;
    }
    if (typeof server.use === "function") {
      server.use(middleware);
    } else {
      console.warn(`[${plugin.name}] Server.use method not available`);
    }
  },
  registerService: (name: string, service: any) => {
    const serviceName = `${plugin.name}:${name}`;
    services.set(serviceName, service);
  },
  getService: (name: string) => {
    // Try plugin-scoped service first
    const scopedName = `${plugin.name}:${name}`;
    if (services.has(scopedName)) {
      return services.get(scopedName);
    }
    // Try global service
    return services.get(name);
  },
  storage: new Map(),
});

/**
 * Register a plugin with the manager
 */
export const registerPlugin = async (
  state: PluginManagerState,
  plugin: Plugin,
  options?: PluginRegistrationOptions,
): Promise<PluginManagerState> => {
  const { metadata } = plugin;

  if (state.plugins.has(metadata.name)) {
    throw new Error(`Plugin '${metadata.name}' is already registered`);
  }

  // Validate dependencies
  if (metadata.dependencies) {
    for (const dep of metadata.dependencies) {
      if (!state.plugins.has(dep)) {
        throw new Error(`Plugin '${metadata.name}' depends on '${dep}' which is not registered`);
      }
    }
  }

  // Create plugin context
  const context = createPluginContext(
    metadata,
    state.server,
    state.router,
    state.services,
    { ...plugin.config, ...options?.config },
    options,
  );
  // Execute beforeRegister hook
  if (plugin.hooks?.beforeRegister) {
    await plugin.hooks.beforeRegister(context);
  }

  // Register the plugin
  await plugin.register(context);

  // Create new state with registered plugin
  const newState: PluginManagerState = {
    ...state,
    plugins: new Map(state.plugins).set(metadata.name, plugin),
    pluginContexts: new Map(state.pluginContexts).set(metadata.name, context),
    registrationOrder: [...state.registrationOrder, metadata.name],
  };

  // Execute afterRegister hook
  if (plugin.hooks?.afterRegister) {
    await plugin.hooks.afterRegister(context);
  }

  context.log("Plugin registered successfully");
  return newState;
};

/**
 * Start all registered plugins
 */
export const startPlugins = async (state: PluginManagerState): Promise<PluginManagerState> => {
  if (state.isStarted) {
    throw new Error("Plugin manager is already started");
  }

  // Execute beforeStart hooks in registration order
  for (const pluginName of state.registrationOrder) {
    const plugin = state.plugins.get(pluginName);
    const context = state.pluginContexts.get(pluginName);

    if (!plugin || !context) {
      continue;
    }

    if (plugin.hooks?.beforeStart) {
      await plugin.hooks.beforeStart(context);
    }
  }

  const newState: PluginManagerState = {
    ...state,
    isStarted: true,
  };

  // Execute afterStart hooks in registration order
  for (const pluginName of state.registrationOrder) {
    const plugin = state.plugins.get(pluginName);
    const context = state.pluginContexts.get(pluginName);

    if (!plugin || !context) {
      continue;
    }

    if (plugin.hooks?.afterStart) {
      await plugin.hooks.afterStart(context);
    }
  }

  console.log(`Plugin manager started with ${state.plugins.size} plugins`);
  return newState;
};

/**
 * Stop all registered plugins
 */
export const stopPlugins = async (state: PluginManagerState): Promise<PluginManagerState> => {
  if (!state.isStarted) {
    return state;
  }

  // Execute beforeStop hooks in reverse order
  for (let i = state.registrationOrder.length - 1; i >= 0; i--) {
    const pluginName = state.registrationOrder[i];
    const plugin = state.plugins.get(pluginName);
    const context = state.pluginContexts.get(pluginName);

    if (!plugin || !context) {
      continue;
    }

    if (plugin.hooks?.beforeStop) {
      await plugin.hooks.beforeStop(context);
    }
  }

  const newState: PluginManagerState = {
    ...state,
    isStarted: false,
  };

  // Execute afterStop hooks in reverse order
  for (let i = state.registrationOrder.length - 1; i >= 0; i--) {
    const pluginName = state.registrationOrder[i];
    const plugin = state.plugins.get(pluginName);
    const context = state.pluginContexts.get(pluginName);

    if (!plugin || !context) {
      continue;
    }

    if (plugin.hooks?.afterStop) {
      await plugin.hooks.afterStop(context);
    }
  }

  console.log("Plugin manager stopped");
  return newState;
};

/**
 * Get plugin by name
 */
export const getPlugin = (state: PluginManagerState, name: string): Plugin | undefined => {
  return state.plugins.get(name);
};

/**
 * Get all registered plugins
 */
export const getPlugins = (state: PluginManagerState): Plugin[] => {
  return Array.from(state.plugins.values());
};

/**
 * Get plugin metadata
 */
export const getPluginMetadata = (state: PluginManagerState): PluginMetadata[] => {
  return Array.from(state.plugins.values()).map((p) => p.metadata);
};

/**
 * Check if a plugin is registered
 */
export const hasPlugin = (state: PluginManagerState, name: string): boolean => {
  return state.plugins.has(name);
};

/**
 * Get a service registered by any plugin
 */
export const getService = (state: PluginManagerState, name: string): any => {
  return state.services.get(name);
};

/**
 * Get all registered services
 */
export const getServices = (state: PluginManagerState): Map<string, any> => {
  return new Map(state.services);
};

/**
 * Plugin builder state
 */
export interface PluginBuilderState {
  readonly metadata: Partial<PluginMetadata>;
  readonly hooks: PluginHooks;
  readonly registerFn?: (context: PluginContext) => void | Promise<void>;
  readonly config: any;
}

/**
 * Create plugin builder state
 */
export const createPluginBuilder = (): PluginBuilderState => ({
  metadata: {},
  hooks: {},
  registerFn: undefined,
  config: {},
});

/**
 * Set plugin metadata
 */
export const setMetadata = (
  state: PluginBuilderState,
  metadata: PluginMetadata,
): PluginBuilderState => ({
  ...state,
  metadata,
});

/**
 * Set plugin name
 */
export const setName = (state: PluginBuilderState, name: string): PluginBuilderState => ({
  ...state,
  metadata: { ...state.metadata, name },
});

/**
 * Set plugin version
 */
export const setVersion = (state: PluginBuilderState, version: string): PluginBuilderState => ({
  ...state,
  metadata: { ...state.metadata, version },
});

/**
 * Set plugin description
 */
export const setDescription = (
  state: PluginBuilderState,
  description: string,
): PluginBuilderState => ({
  ...state,
  metadata: { ...state.metadata, description },
});

/**
 * Set plugin dependencies
 */
export const setDependencies = (
  state: PluginBuilderState,
  dependencies: string[],
): PluginBuilderState => ({
  ...state,
  metadata: { ...state.metadata, dependencies },
});

/**
 * Add lifecycle hooks
 */
export const addHooks = (state: PluginBuilderState, hooks: PluginHooks): PluginBuilderState => ({
  ...state,
  hooks: { ...state.hooks, ...hooks },
});

/**
 * Set register function
 */
export const onRegister = (
  state: PluginBuilderState,
  fn: (context: PluginContext) => void | Promise<void>,
): PluginBuilderState => ({
  ...state,
  registerFn: fn,
});

/**
 * Set plugin configuration
 */
export const setConfig = (state: PluginBuilderState, config: any): PluginBuilderState => ({
  ...state,
  config,
});

/**
 * Build the plugin from state
 */
export const buildPlugin = (state: PluginBuilderState): Plugin => {
  if (!state.metadata.name) {
    throw new Error("Plugin name is required");
  }
  if (!state.metadata.version) {
    throw new Error("Plugin version is required");
  }
  if (!state.registerFn) {
    throw new Error("Plugin register function is required");
  }

  return {
    metadata: state.metadata as PluginMetadata,
    hooks: state.hooks,
    register: state.registerFn,
    config: state.config,
  };
};

/**
 * Helper function to create a plugin
 */
export const createPlugin = (
  metadata: PluginMetadata,
  register: (context: PluginContext) => void | Promise<void>,
  hooks?: PluginHooks,
  config?: any,
): Plugin => {
  return {
    metadata,
    hooks,
    register,
    config,
  };
};

/**
 * Helper function to create a simple plugin builder
 */
export const plugin = (name: string, version: string) => {
  let state = createPluginBuilder();
  state = setName(state, name);
  state = setVersion(state, version);

  const createBuilder = (currentState: PluginBuilderState) => ({
    setDescription: (description: string) => {
      const newState = setDescription(currentState, description);
      return createBuilder(newState);
    },
    setDependencies: (dependencies: string[]) => {
      const newState = setDependencies(currentState, dependencies);
      return createBuilder(newState);
    },
    addHooks: (hooks: PluginHooks) => {
      const newState = addHooks(currentState, hooks);
      return createBuilder(newState);
    },
    onRegister: (fn: (context: PluginContext) => void | Promise<void>) => {
      const newState = onRegister(currentState, fn);
      return createBuilder(newState);
    },
    setConfig: (config: any) => {
      const newState = setConfig(currentState, config);
      return createBuilder(newState);
    },
    build: () => buildPlugin(currentState),
  });

  return createBuilder(state);
};

// Legacy class-based exports for backward compatibility
export class PluginManager {
  private state: PluginManagerState;

  constructor(server: any, router: Router) {
    this.state = createPluginManager(server, router);
  }

  updateServer(server: any): void {
    this.state = updateServer(this.state, server);
    // Update existing plugin contexts with new server
    for (const [_pluginName, context] of this.state.pluginContexts) {
      (context as any).server = server;
    }
  }

  async register(plugin: Plugin, options?: PluginRegistrationOptions): Promise<void> {
    this.state = await registerPlugin(this.state, plugin, options);
  }

  async start(): Promise<void> {
    this.state = await startPlugins(this.state);
  }

  async stop(): Promise<void> {
    this.state = await stopPlugins(this.state);
  }

  getPlugin(name: string): Plugin | undefined {
    return getPlugin(this.state, name);
  }

  getPlugins(): Plugin[] {
    return getPlugins(this.state);
  }

  getPluginMetadata(): PluginMetadata[] {
    return getPluginMetadata(this.state);
  }

  hasPlugin(name: string): boolean {
    return hasPlugin(this.state, name);
  }

  getService(name: string): any {
    return getService(this.state, name);
  }

  getServices(): Map<string, any> {
    return getServices(this.state);
  }
}

export class PluginBuilder {
  private state: PluginBuilderState;

  constructor() {
    this.state = createPluginBuilder();
  }

  setMetadata(metadata: PluginMetadata): this {
    this.state = setMetadata(this.state, metadata);
    return this;
  }

  setName(name: string): this {
    this.state = setName(this.state, name);
    return this;
  }

  setVersion(version: string): this {
    this.state = setVersion(this.state, version);
    return this;
  }

  setDescription(description: string): this {
    this.state = setDescription(this.state, description);
    return this;
  }

  setDependencies(dependencies: string[]): this {
    this.state = setDependencies(this.state, dependencies);
    return this;
  }

  addHooks(hooks: PluginHooks): this {
    this.state = addHooks(this.state, hooks);
    return this;
  }

  onRegister(fn: (context: PluginContext) => void | Promise<void>): this {
    this.state = onRegister(this.state, fn);
    return this;
  }

  setConfig(config: any): this {
    this.state = setConfig(this.state, config);
    return this;
  }

  build(): Plugin {
    return buildPlugin(this.state);
  }
}
