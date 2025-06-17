import { notFound } from "../response.ts";
// Optimized functional router implementation using radix tree
import type {
	Handler,
	Method,
	Middleware,
	RadixNode,
	Route,
	Router,
} from "../types.ts";

/**
 * Creates a new router instance with radix tree optimization
 */
export const createRouter = (): Router => {
	const radixRoots = new Map<Method, RadixNode>();

	return {
		routes: new Map([
			["GET", []],
			["POST", []],
			["PUT", []],
			["DELETE", []],
			["PATCH", []],
			["HEAD", []],
			["OPTIONS", []],
		]),
		middlewares: [],
		radixRoots, // Add radix tree to router instance
	};
};

/**
 * Inserts a route into the radix tree
 */
const insertRoute = (node: RadixNode, path: string, handler: Handler): void => {
	if (path === "") {
		node.handler = handler;
		return;
	}

	// Handle parameters and wildcards
	if (path.startsWith(":")) {
		const paramEnd = path.indexOf("/");
		const paramName = paramEnd === -1 ? path.slice(1) : path.slice(1, paramEnd);
		const remainingPath = paramEnd === -1 ? "" : path.slice(paramEnd);

		let paramChild = node.children.get(":param");
		if (!paramChild) {
			paramChild = {
				path: ":param",
				children: new Map(),
				params: [paramName],
				isWildcard: false,
				isParam: true,
			};
			node.children.set(":param", paramChild);
		}

		insertRoute(paramChild, remainingPath, handler);
		return;
	}

	if (path === "*") {
		node.children.set("*", {
			path: "*",
			handler,
			children: new Map(),
			params: ["*"],
			isWildcard: true,
			isParam: false,
		});
		return;
	}

	// Static path segment
	const nextSlash = path.indexOf("/", 1);
	const segment = nextSlash === -1 ? path : path.slice(0, nextSlash);
	const remainingPath = nextSlash === -1 ? "" : path.slice(nextSlash);

	let child = node.children.get(segment);
	if (!child) {
		child = {
			path: segment,
			children: new Map(),
			params: [],
			isWildcard: false,
			isParam: false,
		};
		node.children.set(segment, child);
	}

	insertRoute(child, remainingPath, handler);
};

/**
 * Searches the radix tree for a matching route with optimized parameter handling
 * Uses a more efficient approach to parameter handling and reduces object creation
 */
const searchRoute = (
	node: RadixNode,
	path: string,
	params: Record<string, string>,
): { handler: Handler; params: Record<string, string> } | null => {
	// Root node or exact match at leaf
	if (path === "") {
		return node.handler ? { handler: node.handler, params } : null;
	}

	// Fast path: Try exact match first (most common case)
	const nextSlash = path.indexOf("/", 1);
	const segment = nextSlash === -1 ? path : path.slice(0, nextSlash);
	const remainingPath = nextSlash === -1 ? "" : path.slice(nextSlash);

	// Check for exact match (fastest path)
	const exactChild = node.children.get(segment);
	if (exactChild) {
		const result = searchRoute(exactChild, remainingPath, params);
		if (result) {
			return result;
		}
	}

	// Try parameter match if no exact match found
	const paramChild = node.children.get(":param");
	if (paramChild && paramChild.params[0]) {
		// Create new params object only when needed
		const newParams = Object.create(params);
		// Set parameter value (remove leading slash)
		newParams[paramChild.params[0]] = segment.slice(1);
		
		const result = searchRoute(paramChild, remainingPath, newParams);
		if (result) {
			return result;
		}
	}

	// Try wildcard match as last resort
	const wildcardChild = node.children.get("*");
	if (wildcardChild?.handler) {
		// Create new params object only when needed
		const newParams = Object.create(params);
		// Set wildcard parameter
		newParams["*"] = path.slice(1); // Remove leading slash
		return { handler: wildcardChild.handler, params: newParams };
	}

	return null;
};

/**
 * Adds a route using the radix tree for optimal performance
 */
export const addRoute = (
	router: Router,
	method: Method,
	path: string,
	handler: Handler,
): void => {
	const radixRoots = router.radixRoots;
	if (!radixRoots) {
		throw new Error("Router radixRoots not initialized");
	}

	// Initialize radix tree root for method if not exists
	if (!radixRoots.has(method)) {
		radixRoots.set(method, {
			path: "",
			children: new Map(),
			params: [],
			isWildcard: false,
			isParam: false,
		});
	}

	const root = radixRoots.get(method);
	if (!root) {
		throw new Error(`No root found for method: ${method}`);
	}
	insertRoute(root, path, handler);

	// Also add to legacy routes array for backward compatibility
	const routes = router.routes.get(method);
	if (!routes) {
		throw new Error(`No routes array found for method: ${method}`);
	}
	const { pattern, params } = compilePath(path);
	routes.push({ method, pattern, params, handler });
};

/**
 * Legacy path compilation for backward compatibility
 */
const compilePath = (path: string): { pattern: RegExp; params: string[] } => {
	const params: string[] = [];
	const pattern = path
		.replace(/\//g, "\\/")
		.replace(/:(\w+)/g, (_, param) => {
			params.push(param);
			return "([^\\/]+)";
		})
		.replace(/\*/g, ".*");

	return { pattern: new RegExp(`^${pattern}$`), params };
};

/**
 * Optimized route finding using radix tree
 * Uses the radix tree as the primary lookup method for better performance
 */
export const findRoute = (
	router: Router,
	method: Method,
	pathname: string,
): { route: Route; params: Record<string, string> } | null => {
	// Use radix tree as primary lookup method
	const radixRoots = router.radixRoots;
	if (!radixRoots) {
		return null;
	}
	
	const root = radixRoots.get(method);
	if (!root) {
		return null; // No routes for this method
	}
	
	const result = searchRoute(root, pathname, {});
	if (result) {
		// Create a route object for compatibility
		const route: Route = {
			method,
			pattern: /(?:)/, // Not used in radix tree
			params: Object.keys(result.params),
			handler: result.handler,
		};
		return { route, params: result.params };
	}
	
	// Only fall back to legacy search if explicitly configured
	// This can be controlled by a feature flag if needed
	if (process.env.ENABLE_LEGACY_ROUTER === 'true') {
		const routes = router.routes.get(method);
		if (routes) {
			for (const route of routes) {
				const match = pathname.match(route.pattern);
				if (match) {
					const params: Record<string, string> = {};
					route.params.forEach((param, i) => {
						params[param] = match[i + 1];
					});
					return { route, params };
				}
			}
		}
	}
	
	return null;
};

/**
 * Adds middleware to the router's middleware stack
 */
export const addMiddleware = (router: Router, middleware: Middleware): void => {
	router.middlewares.push(middleware);
};

/**
 * Handles an incoming request with optimized routing and middleware execution
 * Uses a more efficient approach to middleware chain execution
 */
export const handleRequest = async (
	router: Router,
	req: Request,
): Promise<Response> => {
	const url = new URL(req.url);
	const method = req.method as Method;
	const pathname = url.pathname;

	// Find matching route using optimized radix tree
	const match = findRoute(router, method, pathname);
	if (!match) {
		return notFound();
	}

	// Pre-allocate middleware array length for performance
	const middlewareCount = router.middlewares.length;
	
	// If no middleware, execute handler directly (fast path)
	if (middlewareCount === 0) {
		return match.route.handler(req, match.params);
	}
	
	// Execute middleware chain with optimized recursion
	let index = 0;
	
	// Use a named function for better performance and stack traces
	const executeMiddleware = async (): Promise<Response> => {
		// Check if we've reached the end of middleware chain
		if (index < middlewareCount) {
			const middleware = router.middlewares[index++];
			return middleware(req, executeMiddleware);
		}
		// Execute the final handler with route params
		return match.route.handler(req, match.params);
	};

	return executeMiddleware();
};
