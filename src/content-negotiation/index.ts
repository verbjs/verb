import type { VerbRequest } from './types';

// Content negotiation types
export type MediaType = {
  type: string;
  subtype: string;
  quality: number;
  params: Record<string, string>;
};

export type AcceptItem = {
  value: string;
  quality: number;
  params: Record<string, string>;
};

// Parse Accept header into structured format
export const parseAccept = (acceptHeader: string): AcceptItem[] => {
  if (!acceptHeader) return [];
  
  return acceptHeader
    .split(',')
    .map(item => {
      const parts = item.trim().split(';');
      const value = parts[0].trim();
      let quality = 1.0;
      const params: Record<string, string> = {};
      
      // Parse quality and parameters
      for (let i = 1; i < parts.length; i++) {
        const param = parts[i].trim();
        const [key, val] = param.split('=');
        if (key && val) {
          const cleanKey = key.trim();
          const cleanVal = val.trim().replace(/"/g, '');
          
          if (cleanKey === 'q') {
            quality = parseFloat(cleanVal) || 1.0;
          } else {
            params[cleanKey] = cleanVal;
          }
        }
      }
      
      return { value, quality, params };
    })
    .filter(item => item.value)
    .sort((a, b) => b.quality - a.quality); // Sort by quality descending
};

// Parse media type string into components
export const parseMediaType = (mediaType: string): MediaType => {
  const parts = mediaType.split('/');
  const type = parts[0] || '*';
  const subtypeParts = (parts[1] || '*').split(';');
  const subtype = subtypeParts[0];
  const params: Record<string, string> = {};
  
  // Parse parameters
  for (let i = 1; i < subtypeParts.length; i++) {
    const param = subtypeParts[i].trim();
    const [key, val] = param.split('=');
    if (key && val) {
      params[key.trim()] = val.trim().replace(/"/g, '');
    }
  }
  
  return { type, subtype, quality: 1.0, params };
};

// Check if media type matches pattern
export const matchesMediaType = (mediaType: string, pattern: string): boolean => {
  const parsed = parseMediaType(mediaType.toLowerCase());
  const patternParsed = parseMediaType(pattern.toLowerCase());
  
  // Handle wildcards
  if (patternParsed.type === '*') return true;
  if (parsed.type !== patternParsed.type) return false;
  
  if (patternParsed.subtype === '*') return true;
  if (parsed.subtype !== patternParsed.subtype) return false;
  
  return true;
};

// Get best match for content type negotiation
export const negotiateContentType = (acceptHeader: string, available: string[]): string | null => {
  if (!acceptHeader) return available[0] || null;
  
  const accepted = parseAccept(acceptHeader);
  
  // Find best match
  for (const acceptItem of accepted) {
    for (const availableType of available) {
      if (matchesMediaType(availableType, acceptItem.value)) {
        return availableType;
      }
    }
  }
  
  return null;
};

// Get best match for charset negotiation
export const negotiateCharset = (acceptCharsetHeader: string, available: string[]): string | null => {
  if (!acceptCharsetHeader) return available[0] || null;
  
  const accepted = parseAccept(acceptCharsetHeader);
  
  // Find best match
  for (const acceptItem of accepted) {
    for (const availableCharset of available) {
      if (acceptItem.value === '*' || acceptItem.value.toLowerCase() === availableCharset.toLowerCase()) {
        return availableCharset;
      }
    }
  }
  
  return null;
};

// Get best match for encoding negotiation
export const negotiateEncoding = (acceptEncodingHeader: string, available: string[]): string | null => {
  if (!acceptEncodingHeader) return available[0] || null;
  
  const accepted = parseAccept(acceptEncodingHeader);
  
  // Find best match
  for (const acceptItem of accepted) {
    for (const availableEncoding of available) {
      if (acceptItem.value === '*' || acceptItem.value.toLowerCase() === availableEncoding.toLowerCase()) {
        return availableEncoding;
      }
    }
  }
  
  return null;
};

// Get best match for language negotiation
export const negotiateLanguage = (acceptLanguageHeader: string, available: string[]): string | null => {
  if (!acceptLanguageHeader) return available[0] || null;
  
  const accepted = parseAccept(acceptLanguageHeader);
  
  // Find best match
  for (const acceptItem of accepted) {
    for (const availableLanguage of available) {
      const acceptLang = acceptItem.value.toLowerCase();
      const availLang = availableLanguage.toLowerCase();
      
      if (acceptLang === '*' || acceptLang === availLang) {
        return availableLanguage;
      }
      
      // Check for language prefix match (e.g., 'en' matches 'en-US')
      if (acceptLang.includes('-') && availLang.startsWith(acceptLang.split('-')[0])) {
        return availableLanguage;
      }
      
      if (availLang.includes('-') && acceptLang.startsWith(availLang.split('-')[0])) {
        return availableLanguage;
      }
    }
  }
  
  return null;
};

// Request enhancement functions
export const enhanceRequestWithContentNegotiation = (req: VerbRequest) => {
  // req.accepts() - Content type negotiation
  req.accepts = (types?: string | string[]) => {
    const acceptHeader = req.headers.get('accept') || '';
    
    if (!types) {
      // Return all accepted types
      return parseAccept(acceptHeader).map(item => item.value);
    }
    
    const typesArray = Array.isArray(types) ? types : [types];
    return negotiateContentType(acceptHeader, typesArray);
  };
  
  // req.acceptsCharsets() - Charset negotiation  
  req.acceptsCharsets = (charsets?: string | string[]) => {
    const acceptCharsetHeader = req.headers.get('accept-charset') || '';
    
    if (!charsets) {
      // Return all accepted charsets
      return parseAccept(acceptCharsetHeader).map(item => item.value);
    }
    
    const charsetsArray = Array.isArray(charsets) ? charsets : [charsets];
    return negotiateCharset(acceptCharsetHeader, charsetsArray);
  };
  
  // req.acceptsEncodings() - Encoding negotiation
  req.acceptsEncodings = (encodings?: string | string[]) => {
    const acceptEncodingHeader = req.headers.get('accept-encoding') || '';
    
    if (!encodings) {
      // Return all accepted encodings
      return parseAccept(acceptEncodingHeader).map(item => item.value);
    }
    
    const encodingsArray = Array.isArray(encodings) ? encodings : [encodings];
    return negotiateEncoding(acceptEncodingHeader, encodingsArray);
  };
  
  // req.acceptsLanguages() - Language negotiation
  req.acceptsLanguages = (languages?: string | string[]) => {
    const acceptLanguageHeader = req.headers.get('accept-language') || '';
    
    if (!languages) {
      // Return all accepted languages
      return parseAccept(acceptLanguageHeader).map(item => item.value);
    }
    
    const languagesArray = Array.isArray(languages) ? languages : [languages];
    return negotiateLanguage(acceptLanguageHeader, languagesArray);
  };
  
  return req;
};

// Common MIME types for content negotiation
export const MIME_TYPES = {
  HTML: 'text/html',
  JSON: 'application/json',
  XML: 'application/xml',
  TEXT: 'text/plain',
  CSS: 'text/css',
  JAVASCRIPT: 'application/javascript',
  PDF: 'application/pdf',
  PNG: 'image/png',
  JPEG: 'image/jpeg',
  GIF: 'image/gif',
  SVG: 'image/svg+xml',
  WEBP: 'image/webp',
  MP4: 'video/mp4',
  WEBM: 'video/webm',
  MP3: 'audio/mpeg',
  OGG: 'audio/ogg',
  FORM_URLENCODED: 'application/x-www-form-urlencoded',
  FORM_MULTIPART: 'multipart/form-data',
  OCTET_STREAM: 'application/octet-stream'
};

// Common charsets
export const CHARSETS = {
  UTF8: 'utf-8',
  UTF16: 'utf-16',
  ISO_8859_1: 'iso-8859-1',
  ASCII: 'ascii'
};

// Common encodings
export const ENCODINGS = {
  GZIP: 'gzip',
  DEFLATE: 'deflate',
  BROTLI: 'br',
  IDENTITY: 'identity'
};

// Common languages
export const LANGUAGES = {
  EN: 'en',
  EN_US: 'en-US',
  EN_GB: 'en-GB',
  ES: 'es',
  ES_ES: 'es-ES',
  ES_MX: 'es-MX',
  FR: 'fr',
  FR_FR: 'fr-FR',
  FR_CA: 'fr-CA',
  DE: 'de',
  DE_DE: 'de-DE',
  IT: 'it',
  PT: 'pt',
  RU: 'ru',
  ZH: 'zh',
  ZH_CN: 'zh-CN',
  ZH_TW: 'zh-TW',
  JA: 'ja',
  KO: 'ko',
  AR: 'ar'
};

// Utility functions for response content negotiation
export const respondWithBestFormat = (req: VerbRequest, data: any, formats: Record<string, (data: any) => string>) => {
  const availableTypes = Object.keys(formats);
  const acceptedType = req.accepts?.(availableTypes);
  
  if (acceptedType && formats[acceptedType]) {
    return {
      contentType: acceptedType,
      content: formats[acceptedType](data)
    };
  }
  
  // Default to first available format
  const defaultType = availableTypes[0];
  return {
    contentType: defaultType,
    content: formats[defaultType](data)
  };
};

// Language-aware response helper
export const respondWithLanguage = (req: VerbRequest, translations: Record<string, any>) => {
  const availableLanguages = Object.keys(translations);
  const acceptedLanguage = req.acceptsLanguages?.(availableLanguages);
  
  if (acceptedLanguage && translations[acceptedLanguage]) {
    return {
      language: acceptedLanguage,
      content: translations[acceptedLanguage]
    };
  }
  
  // Default to first available language
  const defaultLanguage = availableLanguages[0];
  return {
    language: defaultLanguage,
    content: translations[defaultLanguage]
  };
};