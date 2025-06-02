// File upload and multipart form parsing utilities

/**
 * Represents an uploaded file from multipart/form-data
 */
export interface UploadedFile {
	/** Original filename provided by the client */
	name: string;
	/** MIME type of the file */
	type: string;
	/** File size in bytes */
	size: number;
	/** File content as a Blob */
	blob: Blob;
	/** Convert file content to ArrayBuffer */
	arrayBuffer: () => Promise<ArrayBuffer>;
	/** Convert file content to text */
	text: () => Promise<string>;
	/** Convert file content to stream */
	stream: () => ReadableStream<Uint8Array>;
}

/**
 * Result of parsing multipart/form-data
 */
export interface MultipartData {
	/** Form fields as key-value pairs */
	fields: Record<string, string | string[]>;
	/** Uploaded files */
	files: Record<string, UploadedFile | UploadedFile[]>;
}

/**
 * Options for multipart parsing
 */
export interface MultipartOptions {
	/** Maximum file size in bytes (default: 10MB) */
	maxFileSize?: number;
	/** Maximum number of files (default: 10) */
	maxFiles?: number;
	/** Maximum field size in bytes (default: 1MB) */
	maxFieldSize?: number;
	/** Maximum total size in bytes (default: 50MB) */
	maxTotalSize?: number;
}

/**
 * Parse multipart/form-data from a request
 * @param req - The request containing multipart data
 * @param options - Parsing options
 * @returns Promise resolving to parsed multipart data
 * @example
 * ```ts
 * const { fields, files } = await parseMultipart(req);
 * 
 * // Access form fields
 * const username = fields.username as string;
 * 
 * // Access uploaded files
 * const avatar = files.avatar as UploadedFile;
 * const documents = files.documents as UploadedFile[];
 * ```
 */
export const parseMultipart = async (
	req: Request,
	options: MultipartOptions = {}
): Promise<MultipartData> => {
	const {
		maxFileSize = 10 * 1024 * 1024, // 10MB
		maxFiles = 10,
		maxFieldSize = 1024 * 1024, // 1MB
		maxTotalSize = 50 * 1024 * 1024, // 50MB
	} = options;

	const contentType = req.headers.get("content-type");
	if (!contentType?.includes("multipart/form-data")) {
		throw new Error("Request is not multipart/form-data");
	}

	// Extract boundary from content type
	const boundaryMatch = contentType.match(/boundary=([^;]+)/);
	if (!boundaryMatch) {
		throw new Error("No boundary found in multipart data");
	}

	const boundary = boundaryMatch[1].trim();
	const body = await req.arrayBuffer();
	
	if (body.byteLength > maxTotalSize) {
		throw new Error(`Request body too large: ${body.byteLength} bytes (max: ${maxTotalSize})`);
	}

	return parseMultipartBuffer(body, boundary, {
		maxFileSize,
		maxFiles,
		maxFieldSize,
		maxTotalSize,
	});
};

/**
 * Parse multipart data from an ArrayBuffer
 * @private
 */
const parseMultipartBuffer = async (
	buffer: ArrayBuffer,
	boundary: string,
	options: Required<MultipartOptions>
): Promise<MultipartData> => {
	const data = new Uint8Array(buffer);
	const boundaryBytes = new TextEncoder().encode(`--${boundary}`);
	const endBoundaryBytes = new TextEncoder().encode(`--${boundary}--`);
	
	const fields: Record<string, string | string[]> = {};
	const files: Record<string, UploadedFile | UploadedFile[]> = {};
	
	let fileCount = 0;
	let position = 0;

	// Find first boundary
	position = findBoundary(data, boundaryBytes, position);
	if (position === -1) {
		throw new Error("No initial boundary found");
	}
	position += boundaryBytes.length;
	// Skip CRLF after boundary
	if (position + 1 < data.length && data[position] === 0x0d && data[position + 1] === 0x0a) {
		position += 2;
	}

	while (position < data.length) {
		// Check if we're at the end boundary
		if (position + endBoundaryBytes.length <= data.length) {
			const slice = data.slice(position, position + endBoundaryBytes.length);
			if (arrayEquals(slice, endBoundaryBytes)) {
				break;
			}
		}

		// Parse part headers
		const headerEnd = findSequence(data, new TextEncoder().encode("\r\n\r\n"), position);
		if (headerEnd === -1) {
			throw new Error("Invalid multipart format: no header end found");
		}

		const headerBytes = data.slice(position, headerEnd);
		const headerText = new TextDecoder().decode(headerBytes);
		const headers = parsePartHeaders(headerText);

		position = headerEnd + 4; // Skip "\r\n\r\n"

		// Find next boundary (could be regular boundary or end boundary)
		let nextBoundary = findBoundary(data, boundaryBytes, position);
		const nextEndBoundary = findBoundary(data, endBoundaryBytes, position);
		
		// Use whichever boundary comes first
		if (nextEndBoundary !== -1 && (nextBoundary === -1 || nextEndBoundary < nextBoundary)) {
			nextBoundary = nextEndBoundary;
		}
		
		if (nextBoundary === -1) {
			throw new Error("Invalid multipart format: no closing boundary found");
		}

		// Extract part content (excluding trailing CRLF before boundary)
		let contentEnd = nextBoundary;
		// Check for CRLF before boundary and exclude it
		if (contentEnd >= 2 && data[contentEnd - 2] === 0x0d && data[contentEnd - 1] === 0x0a) {
			contentEnd -= 2;
		}
		const contentBytes = data.slice(position, contentEnd);

		// Process the part
		await processPart(headers, contentBytes, fields, files, options, fileCount);
		
		if (headers.filename) {
			fileCount++;
			if (fileCount > options.maxFiles) {
				throw new Error(`Too many files: ${fileCount} (max: ${options.maxFiles})`);
			}
		}

		// Move position past the boundary
		if (nextBoundary === nextEndBoundary) {
			// We hit the end boundary, so we're done
			break;
		}
		
		// Regular boundary, continue to next part
		position = nextBoundary + boundaryBytes.length;
		// Skip CRLF after boundary
		if (position + 1 < data.length && data[position] === 0x0d && data[position + 1] === 0x0a) {
			position += 2;
		}
	}

	return { fields, files };
};

/**
 * Parse part headers from header text
 * @private
 */
const parsePartHeaders = (headerText: string): PartHeaders => {
	const lines = headerText.split("\r\n");
	const headers: PartHeaders = {};

	for (const line of lines) {
		if (!line.trim()) continue;

		const colonIndex = line.indexOf(":");
		if (colonIndex === -1) continue;

		const name = line.slice(0, colonIndex).trim().toLowerCase();
		const value = line.slice(colonIndex + 1).trim();

		if (name === "content-disposition") {
			const nameMatch = value.match(/name="([^"]+)"/);
			const filenameMatch = value.match(/filename="([^"]*)"/);

			if (nameMatch) headers.name = nameMatch[1];
			if (filenameMatch) headers.filename = filenameMatch[1];
		} else if (name === "content-type") {
			headers.contentType = value;
		}
	}

	return headers;
};

/**
 * Process a single multipart part
 * @private
 */
const processPart = async (
	headers: PartHeaders,
	content: Uint8Array,
	fields: Record<string, string | string[]>,
	files: Record<string, UploadedFile | UploadedFile[]>,
	options: Required<MultipartOptions>,
	fileCount: number
): Promise<void> => {
	if (!headers.name) {
		throw new Error("Part missing name attribute");
	}

	// Handle file upload
	if (headers.filename !== undefined) {
		if (content.length > options.maxFileSize) {
			throw new Error(
				`File too large: ${content.length} bytes (max: ${options.maxFileSize})`
			);
		}

		const blob = new Blob([content], { type: headers.contentType || "application/octet-stream" });
		const file: UploadedFile = {
			name: headers.filename,
			type: headers.contentType || "application/octet-stream",
			size: content.length,
			blob,
			arrayBuffer: () => blob.arrayBuffer(),
			text: () => blob.text(),
			stream: () => blob.stream(),
		};

		// Handle multiple files with same name
		const existing = files[headers.name];
		if (existing) {
			if (Array.isArray(existing)) {
				existing.push(file);
			} else {
				files[headers.name] = [existing, file];
			}
		} else {
			files[headers.name] = file;
		}
	} else {
		// Handle form field
		if (content.length > options.maxFieldSize) {
			throw new Error(
				`Field too large: ${content.length} bytes (max: ${options.maxFieldSize})`
			);
		}

		const value = new TextDecoder().decode(content);

		// Handle multiple values with same name
		const existing = fields[headers.name];
		if (existing) {
			if (Array.isArray(existing)) {
				existing.push(value);
			} else {
				fields[headers.name] = [existing, value];
			}
		} else {
			fields[headers.name] = value;
		}
	}
};

/**
 * Part headers interface
 * @private
 */
interface PartHeaders {
	name?: string;
	filename?: string;
	contentType?: string;
}

/**
 * Find boundary in data starting from position
 * @private
 */
const findBoundary = (data: Uint8Array, boundary: Uint8Array, start: number): number => {
	return findSequence(data, boundary, start);
};

/**
 * Find a sequence of bytes in data
 * @private
 */
const findSequence = (data: Uint8Array, sequence: Uint8Array, start: number): number => {
	for (let i = start; i <= data.length - sequence.length; i++) {
		let found = true;
		for (let j = 0; j < sequence.length; j++) {
			if (data[i + j] !== sequence[j]) {
				found = false;
				break;
			}
		}
		if (found) return i;
	}
	return -1;
};

/**
 * Check if two Uint8Arrays are equal
 * @private
 */
const arrayEquals = (a: Uint8Array, b: Uint8Array): boolean => {
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i++) {
		if (a[i] !== b[i]) return false;
	}
	return true;
};

/**
 * Check if request contains multipart data
 * @param req - The request to check
 * @returns True if request has multipart/form-data content type
 */
export const isMultipartRequest = (req: Request): boolean => {
	const contentType = req.headers.get("content-type");
	return !!(contentType?.includes("multipart/form-data"));
};

/**
 * Save uploaded file to disk
 * @param file - The uploaded file to save
 * @param path - Path where to save the file
 * @returns Promise that resolves when file is saved
 * @example
 * ```ts
 * const { files } = await parseMultipart(req);
 * const avatar = files.avatar as UploadedFile;
 * await saveFile(avatar, "./uploads/avatar.jpg");
 * ```
 */
export const saveFile = async (file: UploadedFile, path: string): Promise<void> => {
	const buffer = await file.arrayBuffer();
	await Bun.write(path, buffer);
};

/**
 * Create a temporary file from uploaded file
 * @param file - The uploaded file
 * @param extension - File extension to use
 * @returns Promise resolving to temporary file path
 */
export const createTempFile = async (file: UploadedFile, extension?: string): Promise<string> => {
	const ext = extension || file.name.split('.').pop() || 'tmp';
	const tempPath = `/tmp/upload_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
	await saveFile(file, tempPath);
	return tempPath;
};
