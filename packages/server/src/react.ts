import React from "react";
import type { RenderOptions } from "@verb/plugins";

/**
 * Renders a React component to an HTTP response
 * @param component - React component to render
 * @param options - Rendering options
 * @returns HTTP Response with rendered React component
 * @example
 * ```tsx
 * import { reactComponent } from "verb/react";
 * import { Welcome } from "./components/Welcome";
 *
 * app.get("/", (req) => {
 *   return reactComponent(<Welcome name="World" />, {
 *     title: "Welcome Page",
 *     styles: ["/styles.css"],
 *     scripts: ["/bundle.js"],
 *     hydrate: true,
 *   });
 * });
 * ```
 */
export const reactComponent = (
  component: React.ReactElement,
  options: RenderOptions = {},
): Response => {
  // Get the render function from the plugin service
  const renderService = getReactRenderService();

  if (!renderService) {
    throw new Error(
      "React renderer service not found. Make sure to register the React renderer plugin.",
    );
  }

  return renderService(component, options);
};

/**
 * Renders a React component to a string
 * @param component - React component to render
 * @param options - Rendering options
 * @returns HTML string with rendered React component
 */
export const renderToString = (
  component: React.ReactElement,
  options: RenderOptions = {},
): string => {
  const renderService = getReactStringRenderService();

  if (!renderService) {
    throw new Error(
      "React string renderer service not found. Make sure to register the React renderer plugin.",
    );
  }

  return renderService(component, options);
};

/**
 * Renders a React component to a stream
 * @param component - React component to render
 * @param options - Rendering options
 * @returns ReadableStream with rendered React component
 */
export const renderToStream = (
  component: React.ReactElement,
  options: RenderOptions = {},
): ReadableStream => {
  const renderService = getReactStreamRenderService();

  if (!renderService) {
    throw new Error(
      "React stream renderer service not found. Make sure to register the React renderer plugin.",
    );
  }

  return renderService(component, options);
};

// Helper to get the React render service
function getReactRenderService():
  | ((component: React.ReactElement, options: RenderOptions) => Response)
  | null {
  if (typeof globalThis !== "undefined" && (globalThis as any).reactComponent) {
    return (globalThis as any).reactComponent;
  }

  // Try to get from plugin system if available
  if (typeof globalThis !== "undefined" && (globalThis as any).verbPlugins) {
    return (globalThis as any).verbPlugins.getService("react:render");
  }

  return null;
}

// Helper to get the React string render service
function getReactStringRenderService():
  | ((component: React.ReactElement, options: RenderOptions) => string)
  | null {
  if (typeof globalThis !== "undefined" && (globalThis as any).verbPlugins) {
    return (globalThis as any).verbPlugins.getService("react:renderToString");
  }

  return null;
}

// Helper to get the React stream render service
function getReactStreamRenderService():
  | ((component: React.ReactElement, options: RenderOptions) => ReadableStream)
  | null {
  if (typeof globalThis !== "undefined" && (globalThis as any).verbPlugins) {
    return (globalThis as any).verbPlugins.getService("react:renderToStream");
  }

  return null;
}

// Re-export React for convenience
export { React };
