import type { VerbRequest, VerbResponse, Middleware } from '../types';
import { createServer } from '../server';

type AppInstance = ReturnType<typeof createServer>

export type SubApplication = {
  server: AppInstance;
  mountPath: string;
  domain?: string;
  subdomain?: string;
  middleware?: Middleware[];
};

export type VirtualHost = {
  domain: string;
  subdomain?: string;
  server: AppInstance;
};

export type MountOptions = {
  strict?: boolean; // Strict path matching
  caseSensitive?: boolean; // Case sensitive path matching
  mergeParams?: boolean; // Merge route parameters
  domain?: string; // Domain restriction
  subdomain?: string; // Subdomain restriction
};

// Sub-application registry
const subApplications = new Map<string, SubApplication>();
const virtualHosts = new Map<string, VirtualHost>();

// Create a sub-application
export const createSubApplication = (mountPath: string, options: MountOptions = {}): AppInstance => {
  const subApp = createServer();
  
  // Store sub-application
  const subApplication: SubApplication = {
    server: subApp,
    mountPath,
    domain: options.domain,
    subdomain: options.subdomain,
    middleware: []
  };
  
  const key = `${options.domain || '*'}:${options.subdomain || '*'}:${mountPath}`;
  subApplications.set(key, subApplication);
  
  // Enhance sub-application with mount information
  (subApp as any).mountPath = mountPath;
  (subApp as any).parent = null; // Will be set when mounted
  (subApp as any).mountOptions = options;
  
  return subApp;
};

// Mount a sub-application
export const mountSubApplication = (
  parentApp: AppInstance,
  mountPath: string,
  subApp: AppInstance,
  options: MountOptions = {}
) => {
  // Set parent relationship
  (subApp as any).parent = parentApp;
  (subApp as any).mountPath = mountPath;
  (subApp as any).mountOptions = options;
  
  // Create mounting middleware
  const mountingMiddleware: Middleware = async (req: VerbRequest, res: VerbResponse, next: () => void) => {
    const url = new URL(req.url);
    const requestPath = url.pathname;
    const hostname = req.hostname || url.hostname;
    
    // Check domain restrictions
    if (options.domain && hostname !== options.domain) {
      return next();
    }
    
    // Check subdomain restrictions
    if (options.subdomain) {
      const hostParts = hostname.split('.');
      const subdomain = hostParts[0];
      if (subdomain !== options.subdomain) {
        return next();
      }
    }
    
    // Check path matching
    const pathMatches = options.strict 
      ? requestPath === mountPath
      : requestPath.startsWith(mountPath);
    
    if (!pathMatches) {
      return next();
    }
    
    // Strip mount path and delegate to sub-application
    const subPath = requestPath.slice(mountPath.length) || '/';
    const originalUrl = req.url;
    const originalPath = (req as any).path;
    
    // Create sub-request
    const subRequest = {
      ...req,
      url: req.url.replace(requestPath, subPath),
      path: subPath,
      baseUrl: mountPath,
      originalUrl
    };
    
    // Merge parameters if enabled
    if (options.mergeParams) {
      subRequest.params = { ...req.params, ...subRequest.params };
    }
    
    // Try to handle with sub-application
    try {
      const subFetch = subApp.createFetchHandler();
      const subResponse = await subFetch(new Request(subRequest.url, {
        method: req.method,
        headers: req.headers,
        body: req.body
      }));
      
      // If sub-application handled the request, we're done
      if (subResponse.status !== 404) {
        // Copy response from sub-application
        res.status(subResponse.status);
        subResponse.headers.forEach((value, key) => {
          res.header(key, value);
        });
        
        const responseBody = await subResponse.text();
        res.send(responseBody);
        return;
      }
    } catch (error) {
      console.error('Sub-application error:', error);
    }
    
    // Restore original request properties
    (req as any).url = originalUrl;
    (req as any).path = originalPath;
    
    next();
  };
  
  // Add mounting middleware to parent
  parentApp.use(mountingMiddleware);
  
  return parentApp;
};

// Virtual host support
export const createVirtualHost = (domain: string, subdomain?: string): AppInstance => {
  const vhost = createServer();
  
  const virtualHost: VirtualHost = {
    domain,
    subdomain,
    server: vhost
  };
  
  const key = `${domain}:${subdomain || '*'}`;
  virtualHosts.set(key, virtualHost);
  
  return vhost;
};

// Virtual host middleware
export const virtualHostMiddleware = (): Middleware => {
  return async (req: VerbRequest, res: VerbResponse, next: () => void) => {
    const hostname = req.hostname || new URL(req.url).hostname;
    const hostParts = hostname.split('.');
    const subdomain = hostParts.length > 2 ? hostParts[0] : undefined;
    const domain = hostParts.slice(-2).join('.');
    
    // Try exact match first
    const exactKey = `${domain}:${subdomain || '*'}`;
    let vhost = virtualHosts.get(exactKey);
    
    // Try wildcard subdomain match
    if (!vhost) {
      const wildcardKey = `${domain}:*`;
      vhost = virtualHosts.get(wildcardKey);
    }
    
    if (vhost) {
      try {
        const vhostFetch = vhost.server.createFetchHandler();
        const vhostResponse = await vhostFetch(new Request(req.url, {
          method: req.method,
          headers: req.headers,
          body: req.body
        }));
        
        // Copy response from virtual host
        res.status(vhostResponse.status);
        vhostResponse.headers.forEach((value, key) => {
          res.header(key, value);
        });
        
        const responseBody = await vhostResponse.text();
        res.send(responseBody);
        return;
      } catch (error) {
        console.error('Virtual host error:', error);
      }
    }
    
    next();
  };
};

// Get all sub-applications
export const getSubApplications = (): Map<string, SubApplication> => {
  return new Map(subApplications);
};

// Get all virtual hosts
export const getVirtualHosts = (): Map<string, VirtualHost> => {
  return new Map(virtualHosts);
};

// Remove sub-application
export const removeSubApplication = (key: string): boolean => {
  return subApplications.delete(key);
};

// Remove virtual host
export const removeVirtualHost = (key: string): boolean => {
  return virtualHosts.delete(key);
};

// Application hierarchy utilities
export const getApplicationHierarchy = (app: AppInstance): AppInstance[] => {
  const hierarchy: AppInstance[] = [app];
  let current = app;
  
  while ((current as any).parent) {
    current = (current as any).parent;
    hierarchy.unshift(current);
  }
  
  return hierarchy;
};

// Check if application is mounted
export const isMounted = (app: AppInstance): boolean => {
  return !!(app as any).parent;
};

// Get mount path
export const getMountPath = (app: AppInstance): string => {
  return (app as any).mountPath || '/';
};

// Get full mount path (including parent paths)
export const getFullMountPath = (app: AppInstance): string => {
  const hierarchy = getApplicationHierarchy(app);
  const path = hierarchy
    .slice(1) // Skip root app
    .map(app => getMountPath(app))
    .join('')
    .replace(/\/+/g, '/') // Remove duplicate slashes
    .replace(/\/$/, ''); // Remove trailing slash
  
  return path || '/';
};