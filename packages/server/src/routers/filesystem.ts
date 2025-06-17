/**
 * File-based routing system for Verb
 * Inspired by Nitro.build and Hono's filesystem routing
 */

import { type Dirent, readdirSync, statSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";
import type { Handler, Method, Middleware } from "../types.ts";

/**
 * Route information extracted from filesystem
 */
interface FileRoute {
	/** HTTP method */
	method: Method;
	/** Route pattern with parameters */
	pattern: string;
	/** Absolute file path */
	filePath: string;
	/** Route handler */
	handler: Handler;
	/** File modification time for hot reloading */
	mtime: number;
}

/**
 * Filesystem router configuration
 */
interface FilesystemRouterOptions {
	/** Root directory to scan for routes (default: "./routes") */
	routesDir?: string;
	/** File extensions to consider as routes (default: [".ts", ".js"]) */
	extensions?: string[];
	/** Enable hot reloading in development (default: true) */
	hotReload?: boolean;
	/** Custom route pattern transformation */
	transformPattern?: (filePath: string) => string;
	/** Filter function for route files */
	filter?: (filePath: string) => boolean;
}

/**
 * Filesystem router state
 */
interface FilesystemRouterState {
	/** Registered routes */
	routes: Map<string, FileRoute[]>;
	/** Middleware stack */
	middlewares: Middleware[];
	/** Router configuration */
	options: Required<FilesystemRouterOptions>;
	/** Last scan time for hot reloading */
	lastScan: number;
	/** Route file cache */
	fileCache: Map<string, { handler: Handler; mtime: number }>;
}

/**
 * Default filesystem router options
 */
const defaultOptions: Required<FilesystemRouterOptions> = {
	routesDir: "./routes",
	extensions: [".ts", ".js"],
	hotReload: true,
	transformPattern: defaultPatternTransform,
	filter: () => true,
};

/**
 * Default pattern transformation for file paths
 */
function defaultPatternTransform(filePath: string): string {
	let pattern = filePath
		// Remove extension
		.replace(/\.[^.]+$/, "")
		// Convert filesystem separators to forward slashes
		.replace(/\\/g, "/")
		// Handle index routes
		.replace(/\/index$/, "")
		// Handle root index
		.replace(/^index$/, "");

	// Convert dynamic parameters: [id] -> :id
	pattern = pattern.replace(/\[([^\]]+)\]/g, ":$1");

	// Convert catch-all routes: [...rest] -> *
	pattern = pattern.replace(/\[\.\.\.([^\]]+)\]/g, "*");

	// Ensure pattern starts with /
	if (!pattern.startsWith("/")) {
		pattern = `/${pattern}`;
	}

	// Handle empty pattern (root)
	if (pattern === "/") {
		return "/";
	}

	return pattern;
}

/**
 * Extract HTTP method from filename
 */
function extractMethodFromFilename(filename: string): Method {
	const methodMatch = filename.match(
		/^(get|post|put|delete|patch|head|options)\./i,
	);
	if (methodMatch) {
		return methodMatch[1].toUpperCase() as Method;
	}
	return "GET"; // Default method
}

/**
 * Create a new filesystem router
 */
export const createFilesystemRouter = (
	options?: FilesystemRouterOptions,
): FilesystemRouterState => {
	const mergedOptions = { ...defaultOptions, ...options };

	const state: FilesystemRouterState = {
		routes: new Map(),
		middlewares: [],
		options: mergedOptions,
		lastScan: 0,
		fileCache: new Map(),
	};

	// Initial route scanning
	scanRoutes(state);

	return state;
};

/**
 * Scan the filesystem for route files
 */
export const scanRoutes = async (
	state: FilesystemRouterState,
): Promise<void> => {
	const { routesDir, extensions, filter, transformPattern } = state.options;

	try {
		// Check if routes directory exists
		const routesDirStat = statSync(routesDir);
		if (!routesDirStat.isDirectory()) {
			console.warn(`Routes directory not found: ${routesDir}`);
			return;
		}
	} catch {
		console.warn(`Routes directory not accessible: ${routesDir}`);
		return;
	}

	const newRoutes = new Map<string, FileRoute[]>();
	const newFileCache = new Map<string, { handler: Handler; mtime: number }>();

	await scanDirectory(routesDir, routesDir, newRoutes, newFileCache, {
		extensions,
		filter,
		transformPattern,
	});

	state.routes = newRoutes;
	state.fileCache = newFileCache;
	state.lastScan = Date.now();

	const totalRoutes = Array.from(newRoutes.values()).reduce(
		(sum, routes) => sum + routes.length,
		0,
	);
	console.log(
		`Filesystem router: scanned ${totalRoutes} routes from ${routesDir}`,
	);
};

/**
 * Recursively scan directory for route files
 */
async function scanDirectory(
	currentDir: string,
	baseDir: string,
	routes: Map<string, FileRoute[]>,
	fileCache: Map<string, { handler: Handler; mtime: number }>,
	options: {
		extensions: string[];
		filter: (filePath: string) => boolean;
		transformPattern: (filePath: string) => string;
	},
): Promise<void> {
	let entries: Dirent[];

	try {
		entries = readdirSync(currentDir, { withFileTypes: true });
	} catch (error) {
		console.warn(`Failed to read directory ${currentDir}:`, error);
		return;
	}

	for (const entry of entries) {
		const fullPath = join(currentDir, entry.name);

		if (entry.isDirectory()) {
			// Recursively scan subdirectories
			await scanDirectory(fullPath, baseDir, routes, fileCache, options);
		} else if (entry.isFile()) {
			const ext = extname(entry.name);

			// Check if file should be processed
			if (!options.extensions.includes(ext)) {
				continue;
			}
			if (!options.filter(fullPath)) {
				continue;
			}

			// Get relative path from base directory
			const relativePath = relative(baseDir, fullPath);

			try {
				// Get file stats for hot reloading
				const stats = statSync(fullPath);

				// Extract method from filename
				const method = extractMethodFromFilename(entry.name);

				// Transform file path to route pattern
				const pattern = options.transformPattern(relativePath);

				// Load route handler
				const handler = await loadRouteHandler(
					fullPath,
					fileCache,
					stats.mtime.getTime(),
				);

				if (handler) {
					const route: FileRoute = {
						method,
						pattern,
						filePath: fullPath,
						handler,
						mtime: stats.mtime.getTime(),
					};

					// Group routes by method
					const key = method;
					if (!routes.has(key)) {
						routes.set(key, []);
					}
					routes.get(key)?.push(route);
				}
			} catch (error) {
				console.error(`Failed to load route ${fullPath}:`, error);
			}
		}
	}
}

/**
 * Load route handler from file
 */
async function loadRouteHandler(
	filePath: string,
	fileCache: Map<string, { handler: Handler; mtime: number }>,
	mtime: number,
): Promise<Handler | null> {
	// Check cache for hot reloading
	const cached = fileCache.get(filePath);
	if (cached && cached.mtime === mtime) {
		return cached.handler;
	}

	try {
		// Clear require cache for hot reloading (if applicable)
		if (typeof require !== "undefined" && require.cache) {
			delete require.cache[filePath];
		}

		// Dynamic import for ES modules
		const module = await import(`file://${filePath}?t=${Date.now()}`);

		// Look for default export (handler function)
		if (typeof module.default === "function") {
			const handler = module.default as Handler;

			// Cache the handler
			fileCache.set(filePath, { handler, mtime });

			return handler;
		}

		console.warn(
			`Route file ${filePath} does not export a default handler function`,
		);
		return null;
	} catch (error) {
		console.error(`Failed to import route handler from ${filePath}:`, error);
		return null;
	}
}

/**
 * Add middleware to filesystem router
 */
export const addFilesystemMiddleware = (
	state: FilesystemRouterState,
	middleware: Middleware,
): void => {
	state.middlewares.push(middleware);
};

/**
 * Match route pattern against URL pathname
 */
function matchRoute(
	pattern: string,
	pathname: string,
): { params: Record<string, string> } | null {
	// Handle exact matches first
	if (pattern === pathname) {
		return { params: {} };
	}

	// Convert pattern to regex
	const paramNames: string[] = [];
	let regexPattern = pattern
		// Escape special regex characters except our placeholders
		.replace(/[.+?^${}()|[\]\\]/g, "\\$&")
		// Handle parameters :name
		.replace(/:([^/]+)/g, (_, name) => {
			paramNames.push(name);
			return "([^/]+)";
		})
		// Handle catch-all *
		.replace(/\*/g, "(.*)");

	// Add anchors
	regexPattern = `^${regexPattern}$`;

	const regex = new RegExp(regexPattern);
	const match = pathname.match(regex);

	if (!match) {
		return null;
	}

	// Extract parameters
	const params: Record<string, string> = {};

	for (let i = 0; i < paramNames.length; i++) {
		if (match[i + 1] !== undefined) {
			params[paramNames[i]] = decodeURIComponent(match[i + 1]);
		}
	}

	// Handle catch-all parameter
	if (pattern.includes("*") && match[match.length - 1] !== undefined) {
		params["*"] = decodeURIComponent(match[match.length - 1]);
	}

	return { params };
}

/**
 * Find matching route in filesystem router
 */
export const findFilesystemRoute = (
	state: FilesystemRouterState,
	method: Method,
	pathname: string,
): { route: FileRoute; params: Record<string, string> } | null => {
	// Check for hot reload if enabled
	if (state.options.hotReload && Date.now() - state.lastScan > 1000) {
		scanRoutes(state);
	}

	const routes = state.routes.get(method);
	if (!routes) {
		return null;
	}

	// Try to match routes in order
	for (const route of routes) {
		const match = matchRoute(route.pattern, pathname);
		if (match) {
			return { route, params: match.params };
		}
	}

	return null;
};

/**
 * Handle request with filesystem router
 */
export const handleFilesystemRequest = async (
	state: FilesystemRouterState,
	req: Request,
): Promise<Response> => {
	const url = new URL(req.url);
	const method = req.method as Method;
	const pathname = url.pathname;

	// Find matching route
	const match = findFilesystemRoute(state, method, pathname);

	if (!match) {
		return new Response("Not Found", { status: 404 });
	}

	// Execute middleware chain
	let index = 0;
	const next = async (): Promise<Response> => {
		if (index < state.middlewares.length) {
			const middleware = state.middlewares[index++];
			return middleware(req, next);
		}

		// Execute route handler
		return match.route.handler(req, match.params);
	};

	return next();
};

/**
 * Get all routes from filesystem router (for debugging)
 */
export const getFilesystemRoutes = (
	state: FilesystemRouterState,
): FileRoute[] => {
	const allRoutes: FileRoute[] = [];

	for (const routes of state.routes.values()) {
		allRoutes.push(...routes);
	}

	return allRoutes.sort((a, b) => a.pattern.localeCompare(b.pattern));
};

/**
 * Hot reload a specific route file
 */
export const reloadRoute = async (
	state: FilesystemRouterState,
	filePath: string,
): Promise<void> => {
	try {
		const stats = statSync(filePath);
		const cached = state.fileCache.get(filePath);

		if (cached && cached.mtime !== stats.mtime.getTime()) {
			// File has been modified, reload it
			await loadRouteHandler(filePath, state.fileCache, stats.mtime.getTime());
			console.log(`Hot reloaded route: ${filePath}`);
		}
	} catch (error) {
		console.error(`Failed to reload route ${filePath}:`, error);
	}
};

/**
 * Clear all cached routes (useful for testing)
 */
export const clearFilesystemRoutes = (state: FilesystemRouterState): void => {
	state.routes.clear();
	state.fileCache.clear();
	state.lastScan = 0;
};

export type { FilesystemRouterState, FilesystemRouterOptions, FileRoute };
