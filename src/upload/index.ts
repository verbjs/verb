export type UploadedFile = {
  name: string;
  size: number;
  type: string;
  content: Blob;
  arrayBuffer: () => Promise<ArrayBuffer>;
  text: () => Promise<string>;
  stream: () => ReadableStream;
  sanitizedName?: string; // sanitized filename for security
  isStreamable?: boolean; // indicates if file supports streaming
};

export type UploadConfig = {
  maxFileSize?: number; // in bytes
  maxRequestSize?: number; // total request size limit
  allowedTypes?: string[]; // MIME types
  uploadDir?: string;
  generateFileName?: (originalName: string) => string;
  enableStreaming?: boolean; // enable streaming for large files
  chunkSize?: number; // chunk size for streaming (default 64KB)
  onProgress?: (bytesUploaded: number, totalBytes: number) => void;
  virusScanHook?: (file: UploadedFile) => Promise<boolean>; // return true if clean
};

export const parseFormData = async (
  request: Request,
  config: UploadConfig = {},
): Promise<{
  fields: Record<string, string>;
  files: Record<string, UploadedFile | UploadedFile[]>;
  totalSize: number;
}> => {
  // Check request size early to prevent memory overflow
  const contentLength = request.headers.get("content-length");
  if (contentLength && config.maxRequestSize) {
    const requestSize = parseInt(contentLength, 10);
    if (requestSize > config.maxRequestSize) {
      throw new Error(`Request size ${requestSize} exceeds maximum ${config.maxRequestSize} bytes`);
    }
  }

  const formData = await request.formData();
  const fields: Record<string, string> = {};
  const files: Record<string, UploadedFile | UploadedFile[]> = {};
  let totalSize = 0;

  for (const [key, value] of Array.from(formData.entries())) {
    if (
      value != null &&
      typeof value === "object" &&
      "name" in (value as any) &&
      "size" in (value as any)
    ) {
      const file = value as File;
      totalSize += file.size;

      // Check total size during parsing
      if (config.maxRequestSize && totalSize > config.maxRequestSize) {
        throw new Error(
          `Total upload size ${totalSize} exceeds maximum ${config.maxRequestSize} bytes`,
        );
      }

      const uploadedFile: UploadedFile = {
        name: file.name,
        size: file.size,
        type: file.type,
        content: file,
        arrayBuffer: () => file.arrayBuffer(),
        text: () => file.text(),
        stream: () => file.stream(),
        sanitizedName: sanitizeFileName(file.name),
        isStreamable: config.enableStreaming && file.size > (config.chunkSize || 65536),
      };

      if (files[key]) {
        if (Array.isArray(files[key])) {
          (files[key] as UploadedFile[]).push(uploadedFile);
        } else {
          files[key] = [files[key] as UploadedFile, uploadedFile];
        }
      } else {
        files[key] = uploadedFile;
      }
    } else {
      fields[key] = value as string;
    }
  }

  return { fields, files, totalSize };
};

export const validateFile = (file: UploadedFile, config: UploadConfig = {}) => {
  const errors: string[] = [];

  if (config.maxFileSize && file.size > config.maxFileSize) {
    errors.push(`File size ${file.size} exceeds maximum ${config.maxFileSize} bytes`);
  }

  if (config.allowedTypes && !config.allowedTypes.includes(file.type)) {
    errors.push(
      `File type ${file.type} not allowed. Allowed types: ${config.allowedTypes.join(", ")}`,
    );
  }

  // Enhanced security validation
  if (file.name && !isValidFileName(file.name)) {
    errors.push(`Invalid filename: ${file.name}`);
  }

  if (file.size === 0) {
    errors.push("Empty files are not allowed");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

export const saveFile = async (file: UploadedFile, config: UploadConfig = {}) => {
  const uploadDir = config.uploadDir || "./uploads";
  const fileName = config.generateFileName
    ? config.generateFileName(file.sanitizedName || file.name)
    : `${Date.now()}-${file.sanitizedName || file.name}`;

  // Ensure upload directory exists
  await Bun.write(`${uploadDir}/.keep`, "");

  const filePath = `${uploadDir}/${fileName}`;

  // Virus scanning hook
  if (config.virusScanHook) {
    const isSafe = await config.virusScanHook(file);
    if (!isSafe) {
      throw new Error("File failed virus scan");
    }
  }

  // Use streaming for large files if enabled
  if (config.enableStreaming && file.isStreamable) {
    await saveFileStream(file, filePath, config);
  } else {
    await Bun.write(filePath, file.content);
  }

  return {
    originalName: file.name,
    fileName,
    path: filePath,
    size: file.size,
    type: file.type,
    sanitizedName: file.sanitizedName,
  };
};

export const generateUniqueFileName = (originalName: string) => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const sanitizedName = sanitizeFileName(originalName);
  const extension = sanitizedName.split(".").pop();
  return `${timestamp}-${random}.${extension}`;
};

// Security functions
export const sanitizeFileName = (filename: string): string => {
  // Remove path traversal attempts and dangerous characters
  const sanitized = filename
    .replace(/\.\.\//g, "") // Remove ../ patterns
    .replace(/\.\.\\/g, "") // Remove ..\ patterns
    .replace(/[\\/:*?"<>|]/g, "_") // Replace invalid chars
    .replace(/^\.+/, "") // Remove leading dots
    .replace(/\.+$/, "") // Remove trailing dots
    .replace(/\s+/g, "_") // Replace spaces with underscores
    .substring(0, 255); // Limit filename length

  return sanitized || "unnamed_file";
};

export const isValidFileName = (filename: string): boolean => {
  // Check for path traversal attempts
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    return false;
  }

  // Check for reserved names (Windows)
  const reservedNames = [
    "CON",
    "PRN",
    "AUX",
    "NUL",
    "COM1",
    "COM2",
    "COM3",
    "COM4",
    "COM5",
    "COM6",
    "COM7",
    "COM8",
    "COM9",
    "LPT1",
    "LPT2",
    "LPT3",
    "LPT4",
    "LPT5",
    "LPT6",
    "LPT7",
    "LPT8",
    "LPT9",
  ];
  const nameWithoutExt = filename.split(".")[0]?.toUpperCase() || "";
  if (reservedNames.includes(nameWithoutExt)) {
    return false;
  }

  // Check filename length
  if (filename.length > 255) {
    return false;
  }

  return true;
};

// Streaming functions
const saveFileStream = async (file: UploadedFile, filePath: string, config: UploadConfig) => {
  const stream = file.stream();
  const reader = stream.getReader();
  let bytesWritten = 0;

  try {
    const fileHandle = Bun.file(filePath).writer();

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      fileHandle.write(value);
      bytesWritten += value.byteLength;

      // Progress callback
      if (config.onProgress) {
        config.onProgress(bytesWritten, file.size);
      }
    }

    fileHandle.end();
  } finally {
    reader.releaseLock();
  }
};

// File type validation by magic numbers
export const validateFileType = async (
  file: UploadedFile,
): Promise<{ valid: boolean; detectedType?: string; errors: string[] }> => {
  const errors: string[] = [];

  try {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer.slice(0, 12)); // Check first 12 bytes

    // Common file signatures
    const signatures = {
      "image/jpeg": [0xff, 0xd8, 0xff],
      "image/png": [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
      "image/gif": [0x47, 0x49, 0x46, 0x38],
      "application/pdf": [0x25, 0x50, 0x44, 0x46],
      "application/zip": [0x50, 0x4b, 0x03, 0x04],
    };

    let detectedType: string | undefined;

    for (const [type, signature] of Object.entries(signatures)) {
      if (bytes.length >= signature.length) {
        const matches = signature.every((byte, index) => bytes[index] === byte);
        if (matches) {
          detectedType = type;
          break;
        }
      }
    }

    // Compare with declared MIME type
    if (detectedType && file.type !== detectedType) {
      errors.push(`File type mismatch: declared ${file.type}, detected ${detectedType}`);
    }

    return {
      valid: errors.length === 0,
      detectedType,
      errors,
    };
  } catch (error) {
    errors.push(
      `Failed to validate file type: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
    return {
      valid: false,
      errors,
    };
  }
};
