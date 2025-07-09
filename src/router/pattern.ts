import type { Method } from "../types";

export type PatternResult = {
  pattern: RegExp;
  keys: string[];
};

export type AdvancedPatternResult = {
  regexp: RegExp;
  keys: string[];
};

/**
 * Enhanced path pattern matching with regex and wildcard support
 * Supports: /users/:id, /users/:id(\d+), /files/*, complex patterns
 */
export const pathToRegex = (path: string, method: Method): PatternResult => {
  const keys: string[] = [];
  
  let pattern = path;
  
  // First, escape only dots to avoid issues
  pattern = pattern.replace(/\./g, '\\.');
  
  // Handle regex parameters first: /users/:id(\d+) -> /users/(\d+)
  pattern = pattern.replace(/:([^(/]+)(\([^)]+\))/g, (_, key, regex) => {
    keys.push(key);
    return regex;
  });
  
  // Handle regular parameters: /users/:id -> /users/([^/]+)
  pattern = pattern.replace(/:([^/]+)/g, (_, key) => {
    keys.push(key);
    return '([^/]+)';
  });
  
  // Handle wildcard routes: /files/* -> /files/(.*)
  pattern = pattern.replace(/\*/g, () => {
    keys.push('*'); // Add wildcard as a key
    return '(.*)';
  });

  return {
    pattern: new RegExp(`^${method}:${pattern}$`),
    keys
  };
};

/**
 * Advanced path pattern matching for VerbRouter instances
 * Supports case sensitivity, strict routing, and flexible matching
 */
export const advancedPathToRegex = (
  path: string, 
  method?: Method | 'USE' | 'PARAM',
  options: { caseSensitive?: boolean; strict?: boolean } = {}
): AdvancedPatternResult => {
  const { caseSensitive = false, strict = false } = options;
  const keys: string[] = [];
  
  const escapeRegex = (str: string): string => {
    return str.replace(/[.+?^${}|[\]\\]/g, '\\$&');
  };
  
  // Handle exact path for USE middleware
  if (method === 'USE' && !path.includes(':') && !path.includes('*')) {
    const pattern = strict ? `^${escapeRegex(path)}$` : `^${escapeRegex(path)}(?:/|$)`;
    return {
      regexp: new RegExp(pattern, caseSensitive ? '' : 'i'),
      keys
    };
  }
  
  // For static routes (no parameters or wildcards), be exact but respect strict setting
  if (!path.includes(':') && !path.includes('*')) {
    const pattern = strict ? `^${escapeRegex(path)}$` : `^${escapeRegex(path)}/?$`;
    return {
      regexp: new RegExp(pattern, caseSensitive ? '' : 'i'),
      keys
    };
  }

  let pattern = path;
  
  // First, escape only dots to avoid issues
  pattern = pattern.replace(/\./g, '\\.');
  
  // Handle regex parameters first: /users/:id(\d+) -> /users/(\d+)
  pattern = pattern.replace(/:([^(/]+)(\([^)]+\))/g, (_, key, regex) => {
    keys.push(key);
    return regex;
  });
  
  // Handle regular parameters: /users/:id -> /users/([^/]+)
  pattern = pattern.replace(/:([^/]+)/g, (_, key) => {
    keys.push(key);
    return '([^/]+)';
  });
  
  // Handle wildcard routes: /files/* -> /files/(.*)
  pattern = pattern.replace(/\*/g, () => {
    keys.push('*'); // Add wildcard as a key
    return '(.*)';
  });

  // Add start/end anchors
  if (strict) {
    pattern = `^${pattern}$`;
  } else {
    pattern = `^${pattern}(?:/|$)`;
  }

  return {
    regexp: new RegExp(pattern, caseSensitive ? '' : 'i'),
    keys
  };
};

/**
 * Check if a path contains dynamic segments
 */
export const isDynamicRoute = (path: string): boolean => {
  return path.includes(':') || path.includes('*');
};

/**
 * Extract parameter names from a path
 */
export const extractParams = (path: string): string[] => {
  const params: string[] = [];
  
  // Extract named parameters
  const namedParams = path.match(/:([^(/]+)/g);
  if (namedParams) {
    params.push(...namedParams.map(param => param.slice(1).split('(')[0] || ''));
  }
  
  // Add wildcard indicator
  if (path.includes('*')) {
    params.push('*');
  }
  
  return params;
};