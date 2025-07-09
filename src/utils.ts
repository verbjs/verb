export const parsePathParams = (pattern: string, path: string) => {
  const patternParts = pattern.split("/");
  const pathParts = path.split("/");

  if (patternParts.length !== pathParts.length) {
    return null;
  }

  const params: Record<string, string> = {};
  const paramKeys: string[] = [];

  for (let i = 0; i < patternParts.length; i++) {
    const patternPart = patternParts[i];
    const pathPart = pathParts[i];

    if (patternPart === undefined || pathPart === undefined) {
      return null;
    }

    if (patternPart.startsWith(":")) {
      const paramName = patternPart.slice(1);
      params[paramName] = pathPart;
      paramKeys.push(paramName);
    } else if (patternPart !== pathPart) {
      return null;
    }
  }

  return { params, paramKeys };
};

export const parseQuery = (url: string) => {
  const queryIndex = url.indexOf("?");
  if (queryIndex === -1) {
    return {};
  }

  const queryString = url.slice(queryIndex + 1);
  if (!queryString) {
    return {};
  }

  const params: Record<string, string> = {};
  let i = 0;

  while (i < queryString.length) {
    const ampIndex = queryString.indexOf("&", i);
    const pair = ampIndex === -1 ? queryString.slice(i) : queryString.slice(i, ampIndex);

    const eqIndex = pair.indexOf("=");
    if (eqIndex === -1) {
      if (pair) {
        params[decodeURIComponent(pair)] = "";
      }
    } else {
      const key = pair.slice(0, eqIndex);
      const value = pair.slice(eqIndex + 1);
      if (key) {
        params[decodeURIComponent(key)] = decodeURIComponent(value);
      }
    }

    if (ampIndex === -1) {
      break;
    }
    i = ampIndex + 1;
  }

  return params;
};
