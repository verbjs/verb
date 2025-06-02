import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import {
	parseMultipart,
	isMultipartRequest,
	saveFile,
	createTempFile,
	type UploadedFile,
	type MultipartData,
} from "../../src/upload.ts";
import { parseBody, json, text } from "../../src/index.ts";
import { createTestApp } from "./setup.ts";
import { unlink, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";

// Helper to create multipart request data
const createMultipartRequest = (
	parts: Array<{
		name: string;
		content: string | Uint8Array;
		filename?: string;
		contentType?: string;
	}>
): { request: Request; boundary: string } => {
	const boundary = `----formdata-test-${Date.now()}`;
	const encoder = new TextEncoder();

	const chunks: Uint8Array[] = [];

	for (let i = 0; i < parts.length; i++) {
		const part = parts[i];
		
		// Boundary
		chunks.push(encoder.encode(`--${boundary}`));
		chunks.push(encoder.encode("\r\n"));

		// Content-Disposition header
		let contentDisposition = `Content-Disposition: form-data; name="${part.name}"`;
		if (part.filename !== undefined) {
			contentDisposition += `; filename="${part.filename}"`;
		}
		chunks.push(encoder.encode(contentDisposition));
		chunks.push(encoder.encode("\r\n"));

		// Content-Type header (for files)
		if (part.contentType) {
			chunks.push(encoder.encode(`Content-Type: ${part.contentType}`));
			chunks.push(encoder.encode("\r\n"));
		}

		// Empty line to separate headers from content
		chunks.push(encoder.encode("\r\n"));

		// Content
		if (typeof part.content === "string") {
			chunks.push(encoder.encode(part.content));
		} else {
			chunks.push(part.content);
		}

		// CRLF after content
		chunks.push(encoder.encode("\r\n"));
	}

	// End boundary
	chunks.push(encoder.encode(`--${boundary}--`));
	chunks.push(encoder.encode("\r\n"));

	// Combine all chunks
	const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
	const body = new Uint8Array(totalLength);
	let offset = 0;
	for (const chunk of chunks) {
		body.set(chunk, offset);
		offset += chunk.length;
	}

	const request = new Request("http://localhost/upload", {
		method: "POST",
		headers: {
			"content-type": `multipart/form-data; boundary=${boundary}`,
		},
		body: body,
	});

	return { request, boundary };
};

describe("File Upload & Multipart Support", () => {
	beforeAll(async () => {
		// Create test upload directory
		if (!existsSync("./test-uploads")) {
			await mkdir("./test-uploads", { recursive: true });
		}
	});

	afterAll(async () => {
		// Clean up test files
		try {
			const { readdir } = await import("node:fs/promises");
			const files = await readdir("./test-uploads");
			for (const file of files) {
				await unlink(`./test-uploads/${file}`);
			}
			await unlink("./test-uploads");
		} catch {
			// Ignore cleanup errors
		}
	});

	describe("isMultipartRequest()", () => {
		test("detects multipart requests", () => {
			const req = new Request("http://localhost", {
				method: "POST",
				headers: { "content-type": "multipart/form-data; boundary=test" },
			});

			expect(isMultipartRequest(req)).toBe(true);
		});

		test("rejects non-multipart requests", () => {
			const req = new Request("http://localhost", {
				method: "POST",
				headers: { "content-type": "application/json" },
			});

			expect(isMultipartRequest(req)).toBe(false);
		});

		test("handles missing content-type", () => {
			const req = new Request("http://localhost");
			expect(isMultipartRequest(req)).toBe(false);
		});
	});

	describe("parseMultipart()", () => {
		test("parses form fields", async () => {
			const { request } = createMultipartRequest([
				{ name: "username", content: "john" },
				{ name: "email", content: "john@example.com" },
				{ name: "age", content: "25" },
			]);

			const result = await parseMultipart(request);

			expect(result.fields).toEqual({
				username: "john",
				email: "john@example.com",
				age: "25",
			});
			expect(result.files).toEqual({});
		});

		test("parses single file upload", async () => {
			const fileContent = "Hello, World!";
			const { request } = createMultipartRequest([
				{ name: "username", content: "john" },
				{
					name: "avatar",
					content: fileContent,
					filename: "avatar.txt",
					contentType: "text/plain",
				},
			]);

			const result = await parseMultipart(request);

			expect(result.fields).toEqual({ username: "john" });
			expect(Object.keys(result.files)).toEqual(["avatar"]);

			const file = result.files.avatar as UploadedFile;
			expect(file.name).toBe("avatar.txt");
			expect(file.type).toBe("text/plain");
			expect(file.size).toBe(fileContent.length);
			expect(await file.text()).toBe(fileContent);
		});

		test("parses multiple file uploads with same name", async () => {
			const { request } = createMultipartRequest([
				{
					name: "documents",
					content: "Document 1",
					filename: "doc1.txt",
					contentType: "text/plain",
				},
				{
					name: "documents",
					content: "Document 2",
					filename: "doc2.txt",
					contentType: "text/plain",
				},
			]);

			const result = await parseMultipart(request);

			expect(result.fields).toEqual({});
			expect(Object.keys(result.files)).toEqual(["documents"]);

			const files = result.files.documents as UploadedFile[];
			expect(Array.isArray(files)).toBe(true);
			expect(files).toHaveLength(2);
			expect(files[0].name).toBe("doc1.txt");
			expect(files[1].name).toBe("doc2.txt");
			expect(await files[0].text()).toBe("Document 1");
			expect(await files[1].text()).toBe("Document 2");
		});

		test("parses multiple form fields with same name", async () => {
			const { request } = createMultipartRequest([
				{ name: "tags", content: "javascript" },
				{ name: "tags", content: "typescript" },
				{ name: "tags", content: "bun" },
			]);

			const result = await parseMultipart(request);

			expect(result.fields.tags).toEqual([
				"javascript",
				"typescript",
				"bun",
			]);
			expect(result.files).toEqual({});
		});

		test("handles binary file data", async () => {
			const binaryData = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); // PNG header
			const { request } = createMultipartRequest([
				{
					name: "image",
					content: binaryData,
					filename: "test.png",
					contentType: "image/png",
				},
			]);

			const result = await parseMultipart(request);

			const file = result.files.image as UploadedFile;
			expect(file.name).toBe("test.png");
			expect(file.type).toBe("image/png");
			expect(file.size).toBe(binaryData.length);

			const arrayBuffer = await file.arrayBuffer();
			const resultData = new Uint8Array(arrayBuffer);
			expect(resultData).toEqual(binaryData);
		});

		test("handles empty filename", async () => {
			const { request } = createMultipartRequest([
				{
					name: "file",
					content: "content",
					filename: "",
					contentType: "text/plain",
				},
			]);

			const result = await parseMultipart(request);

			const file = result.files.file as UploadedFile;
			expect(file.name).toBe("");
			expect(file.type).toBe("text/plain");
		});

		test("handles mixed content", async () => {
			const { request } = createMultipartRequest([
				{ name: "title", content: "My Upload" },
				{
					name: "file",
					content: "File content",
					filename: "test.txt",
					contentType: "text/plain",
				},
				{ name: "description", content: "A test upload" },
			]);

			const result = await parseMultipart(request);

			expect(result.fields).toEqual({
				title: "My Upload",
				description: "A test upload",
			});

			const file = result.files.file as UploadedFile;
			expect(file.name).toBe("test.txt");
			expect(await file.text()).toBe("File content");
		});
	});

	describe("Error Handling", () => {
		test("throws on non-multipart request", async () => {
			const req = new Request("http://localhost", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ test: "data" }),
			});

			await expect(parseMultipart(req)).rejects.toThrow(
				"Request is not multipart/form-data"
			);
		});

		test("throws on missing boundary", async () => {
			const req = new Request("http://localhost", {
				method: "POST",
				headers: { "content-type": "multipart/form-data" },
				body: "test",
			});

			await expect(parseMultipart(req)).rejects.toThrow(
				"No boundary found in multipart data"
			);
		});

		test("throws on file too large", async () => {
			const largeContent = "x".repeat(1024 * 1024 + 1); // 1MB + 1 byte
			const { request } = createMultipartRequest([
				{
					name: "file",
					content: largeContent,
					filename: "large.txt",
					contentType: "text/plain",
				},
			]);

			await expect(
				parseMultipart(request, { maxFileSize: 1024 * 1024 }) // 1MB limit
			).rejects.toThrow("File too large");
		});

		test("throws on too many files", async () => {
			const { request } = createMultipartRequest([
				{
					name: "file1",
					content: "content1",
					filename: "file1.txt",
					contentType: "text/plain",
				},
				{
					name: "file2",
					content: "content2",
					filename: "file2.txt",
					contentType: "text/plain",
				},
				{
					name: "file3",
					content: "content3",
					filename: "file3.txt",
					contentType: "text/plain",
				},
			]);

			await expect(
				parseMultipart(request, { maxFiles: 2 })
			).rejects.toThrow("Too many files");
		});

		test("throws on field too large", async () => {
			const largeField = "x".repeat(1024 + 1); // 1KB + 1 byte
			const { request } = createMultipartRequest([
				{ name: "large_field", content: largeField },
			]);

			await expect(
				parseMultipart(request, { maxFieldSize: 1024 }) // 1KB limit
			).rejects.toThrow("Field too large");
		});

		test("throws on total size too large", async () => {
			const content = "x".repeat(1024 * 512); // 512KB each
			const { request } = createMultipartRequest([
				{ name: "field1", content },
				{ name: "field2", content },
				{ name: "field3", content }, // Total > 1MB
			]);

			await expect(
				parseMultipart(request, { maxTotalSize: 1024 * 1024 }) // 1MB limit
			).rejects.toThrow("Request body too large");
		});
	});

	describe("File Operations", () => {
		test("saveFile() saves file to disk", async () => {
			const content = "Test file content";
			const { request } = createMultipartRequest([
				{
					name: "file",
					content,
					filename: "test.txt",
					contentType: "text/plain",
				},
			]);

			const result = await parseMultipart(request);
			const file = result.files.file as UploadedFile;

			const savePath = "./test-uploads/saved-test.txt";
			await saveFile(file, savePath);

			const savedContent = await Bun.file(savePath).text();
			expect(savedContent).toBe(content);
		});

		test("createTempFile() creates temporary file", async () => {
			const content = "Temporary file content";
			const { request } = createMultipartRequest([
				{
					name: "file",
					content,
					filename: "temp.txt",
					contentType: "text/plain",
				},
			]);

			const result = await parseMultipart(request);
			const file = result.files.file as UploadedFile;

			const tempPath = await createTempFile(file, "txt");

			expect(tempPath).toMatch(/\/tmp\/upload_\d+_[a-z0-9]+\.txt$/);
			expect(existsSync(tempPath)).toBe(true);

			const tempContent = await Bun.file(tempPath).text();
			expect(tempContent).toBe(content);

			// Clean up
			await unlink(tempPath);
		});

		test("createTempFile() infers extension from filename", async () => {
			const { request } = createMultipartRequest([
				{
					name: "file",
					content: "content",
					filename: "test.pdf",
					contentType: "application/pdf",
				},
			]);

			const result = await parseMultipart(request);
			const file = result.files.file as UploadedFile;

			const tempPath = await createTempFile(file);
			expect(tempPath).toMatch(/\.pdf$/);

			// Clean up
			await unlink(tempPath);
		});
	});

	describe("Integration with parseBody()", () => {
		test("parseBody() automatically handles multipart data", async () => {
			const { request } = createMultipartRequest([
				{ name: "username", content: "john" },
				{
					name: "avatar",
					content: "avatar content",
					filename: "avatar.jpg",
					contentType: "image/jpeg",
				},
			]);

			const result = await parseBody(request) as MultipartData;

			expect(result.fields).toEqual({ username: "john" });
			expect(Object.keys(result.files)).toEqual(["avatar"]);

			const file = result.files.avatar as UploadedFile;
			expect(file.name).toBe("avatar.jpg");
			expect(file.type).toBe("image/jpeg");
		});
	});

	describe("UploadedFile interface", () => {
		test("file.arrayBuffer() returns correct data", async () => {
			const binaryData = new Uint8Array([1, 2, 3, 4, 5]);
			const { request } = createMultipartRequest([
				{
					name: "file",
					content: binaryData,
					filename: "data.bin",
					contentType: "application/octet-stream",
				},
			]);

			const result = await parseMultipart(request);
			const file = result.files.file as UploadedFile;

			const arrayBuffer = await file.arrayBuffer();
			expect(new Uint8Array(arrayBuffer)).toEqual(binaryData);
		});

		test("file.text() returns correct string", async () => {
			const textContent = "Hello, 世界!";
			const { request } = createMultipartRequest([
				{
					name: "file",
					content: textContent,
					filename: "text.txt",
					contentType: "text/plain",
				},
			]);

			const result = await parseMultipart(request);
			const file = result.files.file as UploadedFile;

			const text = await file.text();
			expect(text).toBe(textContent);
		});

		test("file.stream() returns readable stream", async () => {
			const content = "Streaming content";
			const { request } = createMultipartRequest([
				{
					name: "file",
					content,
					filename: "stream.txt",
					contentType: "text/plain",
				},
			]);

			const result = await parseMultipart(request);
			const file = result.files.file as UploadedFile;

			const stream = file.stream();
			const reader = stream.getReader();
			const chunks: Uint8Array[] = [];

			let done = false;
			while (!done) {
				const { value, done: readerDone } = await reader.read();
				done = readerDone;
				if (value) chunks.push(value);
			}

			const combined = new Uint8Array(
				chunks.reduce((acc, chunk) => acc + chunk.length, 0)
			);
			let offset = 0;
			for (const chunk of chunks) {
				combined.set(chunk, offset);
				offset += chunk.length;
			}

			const streamedText = new TextDecoder().decode(combined);
			expect(streamedText).toBe(content);
		});
	});

	describe("Verb Mock Server Integration", () => {
		test("handles file upload through server", async () => {
			const app = createTestApp();

			// Create upload endpoint
			app.post("/upload", async (req) => {
				const data = await parseBody(req) as MultipartData;
				return json({
					fields: data.fields,
					fileCount: Object.keys(data.files).length,
					files: Object.entries(data.files).map(([name, file]) => ({
						name,
						filename: Array.isArray(file) ? file[0].name : file.name,
						size: Array.isArray(file) ? file[0].size : file.size,
						type: Array.isArray(file) ? file[0].type : file.type,
					})),
				});
			});

			// Create multipart form data
			const { request } = createMultipartRequest([
				{ name: "title", content: "My Upload" },
				{
					name: "document",
					content: "File content here",
					filename: "test.txt",
					contentType: "text/plain",
				},
			]);

			// Make request to server
			const response = await app.request.raw("/upload", {
				method: "POST",
				headers: request.headers,
				body: request.body,
			});

			expect(response.status).toBe(200);
			const result = await response.json();

			expect(result.fields).toEqual({ title: "My Upload" });
			expect(result.fileCount).toBe(1);
			expect(result.files).toHaveLength(1);
			expect(result.files[0]).toEqual({
				name: "document",
				filename: "test.txt",
				size: "File content here".length,
				type: "text/plain",
			});
		});

		test("handles multiple file uploads", async () => {
			const app = createTestApp();

			app.post("/multi-upload", async (req) => {
				const data = await parseBody(req) as MultipartData;
				const files = data.files.documents as UploadedFile[];
				
				return json({
					message: "Files uploaded successfully",
					count: files.length,
					filenames: files.map(f => f.name),
				});
			});

			const { request } = createMultipartRequest([
				{
					name: "documents",
					content: "Document 1 content",
					filename: "doc1.txt",
					contentType: "text/plain",
				},
				{
					name: "documents",
					content: "Document 2 content",
					filename: "doc2.txt",
					contentType: "text/plain",
				},
			]);

			const response = await app.request.raw("/multi-upload", {
				method: "POST",
				headers: request.headers,
				body: request.body,
			});

			expect(response.status).toBe(200);
			const result = await response.json();

			expect(result.message).toBe("Files uploaded successfully");
			expect(result.count).toBe(2);
			expect(result.filenames).toEqual(["doc1.txt", "doc2.txt"]);
		});

		test("handles upload errors with server", async () => {
			const app = createTestApp();

			app.post("/upload-with-limit", async (req) => {
				try {
					const data = await parseMultipart(req, { maxFileSize: 10 }); // Very small limit
					return json({ success: true });
				} catch (error) {
					return json({ error: (error as Error).message }, 400);
				}
			});

			const { request } = createMultipartRequest([
				{
					name: "file",
					content: "This content is longer than 10 bytes",
					filename: "large.txt",
					contentType: "text/plain",
				},
			]);

			const response = await app.request.raw("/upload-with-limit", {
				method: "POST",
				headers: request.headers,
				body: request.body,
			});

			expect(response.status).toBe(400);
			const result = await response.json();
			expect(result.error).toContain("File too large");
		});
	});
});
