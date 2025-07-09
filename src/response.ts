import type { VerbResponse } from "./types";

// Utility functions for file operations
const getFilenameFromPath = (path: string): string => {
  return path.split("/").pop() || "download";
};

const getMimeType = (path: string): string => {
  const ext = path.split(".").pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    html: "text/html",
    htm: "text/html",
    css: "text/css",
    js: "application/javascript",
    json: "application/json",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    svg: "image/svg+xml",
    pdf: "application/pdf",
    txt: "text/plain",
    md: "text/markdown",
    xml: "application/xml",
    zip: "application/zip",
    mp3: "audio/mpeg",
    mp4: "video/mp4",
    avi: "video/x-msvideo",
    mov: "video/quicktime",
    wav: "audio/wav",
    ico: "image/x-icon",
    woff: "font/woff",
    woff2: "font/woff2",
    ttf: "font/ttf",
    eot: "application/vnd.ms-fontobject",
  };
  return mimeTypes[ext || ""] || "application/octet-stream";
};

const getFileStats = async (path: string): Promise<{ size: number; mtime: Date } | null> => {
  try {
    const file = Bun.file(path);
    const stat = await file.stat();
    return {
      size: stat.size,
      mtime: new Date(stat.mtime || Date.now()),
    };
  } catch {
    return null;
  }
};

export const createResponse = (): { res: VerbResponse; getResponse: () => Promise<Response> } => {
  let responseData: any = null;
  let responseStatus = 200;
  const responseHeaders = new Headers();
  let isFinished = false;

  const ensureNotFinished = () => {
    if (isFinished) {
      throw new Error("Cannot set response after it has been sent");
    }
  };

  const res: VerbResponse = {
    send: (data: string | object | number | boolean) => {
      ensureNotFinished();
      if (typeof data === "object") {
        if (!responseHeaders.get("Content-Type")) {
          responseHeaders.set("Content-Type", "application/json");
        }
        responseData = JSON.stringify(data);
      } else {
        if (!responseHeaders.get("Content-Type")) {
          responseHeaders.set("Content-Type", "text/plain");
        }
        responseData = String(data);
      }
      isFinished = true;
      return res;
    },

    json: (data: any) => {
      ensureNotFinished();
      if (!responseHeaders.get("Content-Type")) {
        responseHeaders.set("Content-Type", "application/json");
      }
      responseData = JSON.stringify(data);
      isFinished = true;
      return res;
    },

    status: (code: number) => {
      ensureNotFinished();
      responseStatus = code;
      return res;
    },

    redirect: (url: string, code = 302) => {
      ensureNotFinished();
      responseStatus = code;
      responseHeaders.set("Location", url);
      responseData = `Redirecting to ${url}`;
      isFinished = true;
      return res;
    },

    html: (content: string) => {
      ensureNotFinished();
      if (!responseHeaders.get("Content-Type")) {
        responseHeaders.set("Content-Type", "text/html");
      }
      responseData = content;
      isFinished = true;
      return res;
    },

    text: (content: string) => {
      ensureNotFinished();
      if (!responseHeaders.get("Content-Type")) {
        responseHeaders.set("Content-Type", "text/plain");
      }
      responseData = content;
      isFinished = true;
      return res;
    },

    react: (component: any, props?: any) => {
      ensureNotFinished();
      if (!responseHeaders.get("Content-Type")) {
        responseHeaders.set("Content-Type", "text/html");
      }

      try {
        // Check if React is available
        if (typeof component === "function") {
          // For functional components, we can try to render them
          const React = globalThis.React;
          if (React?.createElement) {
            const ReactDOMServer = (globalThis as any).ReactDOMServer;
            if (ReactDOMServer?.renderToString) {
              const element = React.createElement(component, props);
              responseData = ReactDOMServer.renderToString(element);
            } else {
              // Fallback: call component as function if no ReactDOMServer
              const result = component(props || {});
              responseData = typeof result === "string" ? result : JSON.stringify(result);
            }
          } else {
            // Fallback: call component as function if no React
            const result = component(props || {});
            responseData = typeof result === "string" ? result : JSON.stringify(result);
          }
        } else if (typeof component === "string") {
          // Direct HTML string
          responseData = component;
        } else {
          // Object or other type
          responseData = JSON.stringify(component);
        }
      } catch (_error) {
        responseStatus = 500;
        responseData = "Error rendering React component";
      }

      isFinished = true;
      return res;
    },

    header: (name: string, value: string) => {
      ensureNotFinished();
      responseHeaders.set(name, value);
      return res;
    },

    headers: (headers: Record<string, string>) => {
      ensureNotFinished();
      Object.entries(headers).forEach(([name, value]) => {
        responseHeaders.set(name, value);
      });
      return res;
    },

    cookie: (name: string, value: string, options?: any) => {
      ensureNotFinished();
      let cookieString = `${name}=${value}`;

      if (options) {
        if (options.maxAge) {
          cookieString += `; Max-Age=${options.maxAge}`;
        }
        if (options.expires) {
          cookieString += `; Expires=${options.expires}`;
        }
        if (options.path) {
          cookieString += `; Path=${options.path}`;
        }
        if (options.domain) {
          cookieString += `; Domain=${options.domain}`;
        }
        if (options.secure) {
          cookieString += `; Secure`;
        }
        if (options.httpOnly) {
          cookieString += `; HttpOnly`;
        }
        if (options.sameSite) {
          cookieString += `; SameSite=${options.sameSite}`;
        }
      }

      responseHeaders.append("Set-Cookie", cookieString);
      return res;
    },

    clearCookie: (name: string) => {
      ensureNotFinished();
      responseHeaders.append(
        "Set-Cookie",
        `${name}=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
      );
      return res;
    },

    type: (contentType: string) => {
      ensureNotFinished();
      responseHeaders.set("Content-Type", contentType);
      return res;
    },

    attachment: (filename?: string) => {
      ensureNotFinished();
      let disposition = "attachment";
      if (filename) {
        disposition += `; filename="${filename}"`;
      }
      responseHeaders.set("Content-Disposition", disposition);
      return res;
    },

    download: async (path: string, filename?: string, _options?: any) => {
      ensureNotFinished();

      // Set attachment headers
      res.attachment(filename || getFilenameFromPath(path));

      try {
        const file = Bun.file(path);
        if (!(await file.exists())) {
          responseStatus = 404;
          responseData = "File not found";
          isFinished = true;
          return res;
        }

        // Get file stats for headers
        const stats = await getFileStats(path);
        if (stats) {
          responseHeaders.set("Content-Length", stats.size.toString());
          if (stats.mtime) {
            responseHeaders.set("Last-Modified", stats.mtime.toUTCString());
          }
        }

        // Set MIME type if not already set
        if (!responseHeaders.get("Content-Type")) {
          const mimeType = getMimeType(path);
          responseHeaders.set("Content-Type", mimeType);
        }

        // Read file and set as response data
        const fileData = await file.arrayBuffer();
        (res as any)._isFile = true;
        (res as any)._rawData = fileData;
        isFinished = true;
      } catch (_error) {
        responseStatus = 500;
        responseData = "Error reading file";
        isFinished = true;
      }

      return res;
    },

    sendFile: async (path: string, options?: any) => {
      ensureNotFinished();

      try {
        const file = Bun.file(path);
        if (!(await file.exists())) {
          responseStatus = 404;
          responseData = "File not found";
          isFinished = true;
          return res;
        }

        // Get file stats for headers
        const stats = await getFileStats(path);
        if (stats) {
          responseHeaders.set("Content-Length", stats.size.toString());
          if (stats.mtime) {
            responseHeaders.set("Last-Modified", stats.mtime.toUTCString());
          }
        }

        // Set MIME type
        const mimeType = getMimeType(path);
        responseHeaders.set("Content-Type", mimeType);

        // Handle range requests if specified in options
        if (options?.acceptRanges !== false) {
          responseHeaders.set("Accept-Ranges", "bytes");
        }

        // Read file and set as response data
        const fileData = await file.arrayBuffer();
        (res as any)._isFile = true;
        (res as any)._rawData = fileData;
        isFinished = true;
      } catch (_error) {
        responseStatus = 500;
        responseData = "Error reading file";
        isFinished = true;
      }

      return res;
    },

    vary: (header: string) => {
      ensureNotFinished();
      const currentVary = responseHeaders.get("Vary");
      if (currentVary) {
        const varyHeaders = currentVary.split(",").map((h) => h.trim());
        if (!varyHeaders.includes(header)) {
          responseHeaders.set("Vary", `${currentVary}, ${header}`);
        }
      } else {
        responseHeaders.set("Vary", header);
      }
      return res;
    },

    end: () => {
      ensureNotFinished();
      if (responseData === null) {
        responseData = "";
      }
      isFinished = true;
      return res;
    },
  };

  const getResponse = async (): Promise<Response> => {
    // Handle file responses from static middleware
    if ((res as any)._isFile && (res as any)._rawData) {
      return new Response((res as any)._rawData, {
        status: responseStatus,
        headers: responseHeaders,
      });
    }

    if (!isFinished && !(res as any)._finished) {
      // Auto-finish if handler didn't call any response method
      responseData = "";
    }

    return new Response(responseData, {
      status: responseStatus,
      headers: responseHeaders,
    });
  };

  return { res, getResponse };
};
