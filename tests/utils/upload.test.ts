import { test, expect } from "bun:test";
import { parseFormData, validateFile, saveFile, generateUniqueFileName, sanitizeFileName, isValidFileName, validateFileType, type UploadedFile, type UploadConfig } from "../../src/upload";

test("generateUniqueFileName creates unique names", () => {
  const name1 = generateUniqueFileName("test.jpg");
  const name2 = generateUniqueFileName("test.jpg");
  
  expect(name1).not.toBe(name2);
  expect(name1).toMatch(/^\d+-[a-z0-9]{6}\.jpg$/);
  expect(name2).toMatch(/^\d+-[a-z0-9]{6}\.jpg$/);
});

test("validateFile accepts valid files", () => {
  const mockFile: UploadedFile = {
    name: "test.jpg",
    size: 1024,
    type: "image/jpeg",
    content: new Blob(),
    arrayBuffer: async () => new ArrayBuffer(0),
    text: async () => "",
    stream: () => new ReadableStream()
  };

  const result = validateFile(mockFile, {
    maxFileSize: 2048,
    allowedTypes: ["image/jpeg", "image/png"]
  });

  expect(result.valid).toBe(true);
  expect(result.errors).toEqual([]);
});

test("validateFile rejects oversized files", () => {
  const mockFile: UploadedFile = {
    name: "large.jpg",
    size: 2048,
    type: "image/jpeg",
    content: new Blob(),
    arrayBuffer: async () => new ArrayBuffer(0),
    text: async () => "",
    stream: () => new ReadableStream()
  };

  const result = validateFile(mockFile, {
    maxFileSize: 1024,
    allowedTypes: ["image/jpeg"]
  });

  expect(result.valid).toBe(false);
  expect(result.errors).toContain("File size 2048 exceeds maximum 1024 bytes");
});

test("validateFile rejects invalid file types", () => {
  const mockFile: UploadedFile = {
    name: "script.exe",
    size: 512,
    type: "application/exe",
    content: new Blob(),
    arrayBuffer: async () => new ArrayBuffer(0),
    text: async () => "",
    stream: () => new ReadableStream()
  };

  const result = validateFile(mockFile, {
    maxFileSize: 1024,
    allowedTypes: ["image/jpeg", "image/png"]
  });

  expect(result.valid).toBe(false);
  expect(result.errors).toContain("File type application/exe not allowed. Allowed types: image/jpeg, image/png");
});

test("validateFile with no restrictions", () => {
  const mockFile: UploadedFile = {
    name: "anything.xyz",
    size: 99999,
    type: "application/unknown",
    content: new Blob(),
    arrayBuffer: async () => new ArrayBuffer(0),
    text: async () => "",
    stream: () => new ReadableStream()
  };

  const result = validateFile(mockFile, {});

  expect(result.valid).toBe(true);
  expect(result.errors).toEqual([]);
});

test("saveFile saves with custom filename", async () => {
  const testContent = "test file content";
  const mockFile: UploadedFile = {
    name: "original.txt",
    size: testContent.length,
    type: "text/plain",
    content: new Blob([testContent]),
    arrayBuffer: async () => new TextEncoder().encode(testContent).buffer,
    text: async () => testContent,
    stream: () => new ReadableStream()
  };

  const result = await saveFile(mockFile, {
    uploadDir: "./test-uploads",
    generateFileName: (name) => `custom-${name}`
  });

  expect(result.originalName).toBe("original.txt");
  expect(result.fileName).toBe("custom-original.txt");
  expect(result.path).toBe("./test-uploads/custom-original.txt");
  expect(result.size).toBe(testContent.length);
  expect(result.type).toBe("text/plain");

  // Verify file was actually saved
  const savedFile = Bun.file(result.path);
  expect(await savedFile.exists()).toBe(true);
  expect(await savedFile.text()).toBe(testContent);

  // Cleanup
  await Bun.$`rm -rf ./test-uploads`;
});

test("parseFormData handles form with files and fields", async () => {
  // Create a mock FormData
  const formData = new FormData();
  formData.append("name", "John Doe");
  formData.append("email", "john@example.com");
  
  const testFile = new File(["test content"], "test.txt", { type: "text/plain" });
  formData.append("file", testFile);

  // Create a mock request
  const mockRequest = new Request("http://localhost/test", {
    method: "POST",
    body: formData
  });

  const result = await parseFormData(mockRequest);

  expect(result.fields.name).toBe("John Doe");
  expect(result.fields.email).toBe("john@example.com");
  expect(result.files.file).toBeDefined();
  
  const uploadedFile = result.files.file as UploadedFile;
  expect(uploadedFile.name).toBe("test.txt");
  expect(uploadedFile.type).toMatch(/^text\/plain/); // May include charset
  expect(uploadedFile.size).toBe(12); // "test content" length
});

test("parseFormData handles multiple files with same name", async () => {
  const formData = new FormData();
  formData.append("description", "Multiple files test");
  
  const file1 = new File(["content 1"], "file1.txt", { type: "text/plain" });
  const file2 = new File(["content 2"], "file2.txt", { type: "text/plain" });
  
  formData.append("files", file1);
  formData.append("files", file2);

  const mockRequest = new Request("http://localhost/test", {
    method: "POST",
    body: formData
  });

  const result = await parseFormData(mockRequest);

  expect(result.fields.description).toBe("Multiple files test");
  expect(Array.isArray(result.files.files)).toBe(true);
  expect(result.totalSize).toBe(18); // "content 1" + "content 2" = 9 + 9 = 18
  
  const files = result.files.files as UploadedFile[];
  expect(files).toHaveLength(2);
  expect(files[0].name).toBe("file1.txt");
  expect(files[1].name).toBe("file2.txt");
  expect(files[0].sanitizedName).toBe("file1.txt");
  expect(files[1].sanitizedName).toBe("file2.txt");
});

// New tests for enhanced functionality

test("parseFormData respects maxRequestSize", async () => {
  const formData = new FormData();
  const largeFile = new File(["x".repeat(2000)], "large.txt", { type: "text/plain" });
  formData.append("file", largeFile);

  const mockRequest = new Request("http://localhost/test", {
    method: "POST",
    body: formData,
    headers: { "content-length": "2000" }
  });

  const config: UploadConfig = {
    maxRequestSize: 1000
  };

  await expect(parseFormData(mockRequest, config)).rejects.toThrow("Request size 2000 exceeds maximum 1000 bytes");
});

test("parseFormData adds sanitized filenames", async () => {
  const formData = new FormData();
  const file = new File(["content"], "../../../etc/passwd", { type: "text/plain" });
  formData.append("file", file);

  const mockRequest = new Request("http://localhost/test", {
    method: "POST",
    body: formData
  });

  const result = await parseFormData(mockRequest);
  const uploadedFile = result.files.file as UploadedFile;
  
  expect(uploadedFile.name).toBe("../../../etc/passwd");
  expect(uploadedFile.sanitizedName).toBe("etc_passwd");
});

test("parseFormData enables streaming for large files", async () => {
  const formData = new FormData();
  const largeFile = new File(["x".repeat(100000)], "large.txt", { type: "text/plain" });
  formData.append("file", largeFile);

  const mockRequest = new Request("http://localhost/test", {
    method: "POST",
    body: formData
  });

  const config: UploadConfig = {
    enableStreaming: true,
    chunkSize: 1024
  };

  const result = await parseFormData(mockRequest, config);
  const uploadedFile = result.files.file as UploadedFile;
  
  expect(uploadedFile.isStreamable).toBe(true);
});

test("sanitizeFileName removes dangerous characters", () => {
  expect(sanitizeFileName("../../../etc/passwd")).toBe("etc_passwd");
  expect(sanitizeFileName("file with spaces.txt")).toBe("file_with_spaces.txt");
  expect(sanitizeFileName("file<>:\"/|?*.txt")).toBe("file________.txt");
  expect(sanitizeFileName(".hidden.txt")).toBe("hidden.txt");
  expect(sanitizeFileName("normal.txt")).toBe("normal.txt");
  expect(sanitizeFileName("")).toBe("unnamed_file");
  expect(sanitizeFileName("file.txt.")).toBe("file.txt");
});

test("isValidFileName detects path traversal", () => {
  expect(isValidFileName("../file.txt")).toBe(false);
  expect(isValidFileName("file/../other.txt")).toBe(false);
  expect(isValidFileName("file\\other.txt")).toBe(false);
  expect(isValidFileName("file/other.txt")).toBe(false);
  expect(isValidFileName("normal.txt")).toBe(true);
});

test("isValidFileName detects reserved names", () => {
  expect(isValidFileName("CON.txt")).toBe(false);
  expect(isValidFileName("PRN.txt")).toBe(false);
  expect(isValidFileName("AUX.txt")).toBe(false);
  expect(isValidFileName("NUL.txt")).toBe(false);
  expect(isValidFileName("COM1.txt")).toBe(false);
  expect(isValidFileName("LPT1.txt")).toBe(false);
  expect(isValidFileName("normal.txt")).toBe(true);
});

test("isValidFileName checks filename length", () => {
  const longName = "a".repeat(256) + ".txt";
  expect(isValidFileName(longName)).toBe(false);
  expect(isValidFileName("normal.txt")).toBe(true);
});

test("validateFile checks for empty files", () => {
  const mockFile: UploadedFile = {
    name: "empty.txt",
    size: 0,
    type: "text/plain",
    content: new Blob(),
    arrayBuffer: async () => new ArrayBuffer(0),
    text: async () => "",
    stream: () => new ReadableStream()
  };

  const result = validateFile(mockFile);
  expect(result.valid).toBe(false);
  expect(result.errors).toContain("Empty files are not allowed");
});

test("validateFile checks filename validity", () => {
  const mockFile: UploadedFile = {
    name: "../../../etc/passwd",
    size: 1024,
    type: "text/plain",
    content: new Blob(),
    arrayBuffer: async () => new ArrayBuffer(0),
    text: async () => "",
    stream: () => new ReadableStream()
  };

  const result = validateFile(mockFile);
  expect(result.valid).toBe(false);
  expect(result.errors).toContain("Invalid filename: ../../../etc/passwd");
});

test("validateFileType detects JPEG files", async () => {
  // JPEG magic number: FF D8 FF
  const jpegBytes = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46]);
  
  const mockFile: UploadedFile = {
    name: "image.jpg",
    size: jpegBytes.length,
    type: "image/jpeg",
    content: new Blob([jpegBytes]),
    arrayBuffer: async () => jpegBytes.buffer,
    text: async () => "",
    stream: () => new ReadableStream()
  };

  const result = await validateFileType(mockFile);
  expect(result.valid).toBe(true);
  expect(result.detectedType).toBe("image/jpeg");
});

test("validateFileType detects PNG files", async () => {
  // PNG magic number: 89 50 4E 47 0D 0A 1A 0A
  const pngBytes = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  
  const mockFile: UploadedFile = {
    name: "image.png",
    size: pngBytes.length,
    type: "image/png",
    content: new Blob([pngBytes]),
    arrayBuffer: async () => pngBytes.buffer,
    text: async () => "",
    stream: () => new ReadableStream()
  };

  const result = await validateFileType(mockFile);
  expect(result.valid).toBe(true);
  expect(result.detectedType).toBe("image/png");
});

test("validateFileType detects type mismatch", async () => {
  // PNG magic number but declared as JPEG
  const pngBytes = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  
  const mockFile: UploadedFile = {
    name: "image.jpg",
    size: pngBytes.length,
    type: "image/jpeg",
    content: new Blob([pngBytes]),
    arrayBuffer: async () => pngBytes.buffer,
    text: async () => "",
    stream: () => new ReadableStream()
  };

  const result = await validateFileType(mockFile);
  expect(result.valid).toBe(false);
  expect(result.detectedType).toBe("image/png");
  expect(result.errors).toContain("File type mismatch: declared image/jpeg, detected image/png");
});

test("saveFile uses sanitized filename", async () => {
  const testContent = "test file content";
  const mockFile: UploadedFile = {
    name: "../../../etc/passwd",
    size: testContent.length,
    type: "text/plain",
    content: new Blob([testContent]),
    arrayBuffer: async () => new TextEncoder().encode(testContent).buffer,
    text: async () => testContent,
    stream: () => new ReadableStream(),
    sanitizedName: "etc_passwd"
  };

  const result = await saveFile(mockFile, {
    uploadDir: "./test-uploads",
    generateFileName: (name) => `custom-${name}`
  });

  expect(result.originalName).toBe("../../../etc/passwd");
  expect(result.fileName).toBe("custom-etc_passwd");
  expect(result.sanitizedName).toBe("etc_passwd");

  // Cleanup
  await Bun.$`rm -rf ./test-uploads`;
});

test("saveFile calls virus scan hook", async () => {
  const testContent = "test file content";
  const mockFile: UploadedFile = {
    name: "test.txt",
    size: testContent.length,
    type: "text/plain",
    content: new Blob([testContent]),
    arrayBuffer: async () => new TextEncoder().encode(testContent).buffer,
    text: async () => testContent,
    stream: () => new ReadableStream(),
    sanitizedName: "test.txt"
  };

  let scanCalled = false;
  const virusScanHook = async (file: UploadedFile) => {
    scanCalled = true;
    expect(file.name).toBe("test.txt");
    return true; // File is clean
  };

  await saveFile(mockFile, {
    uploadDir: "./test-uploads",
    virusScanHook
  });

  expect(scanCalled).toBe(true);

  // Cleanup
  await Bun.$`rm -rf ./test-uploads`;
});

test("saveFile rejects infected files", async () => {
  const testContent = "malicious content";
  const mockFile: UploadedFile = {
    name: "malware.exe",
    size: testContent.length,
    type: "application/octet-stream",
    content: new Blob([testContent]),
    arrayBuffer: async () => new TextEncoder().encode(testContent).buffer,
    text: async () => testContent,
    stream: () => new ReadableStream(),
    sanitizedName: "malware.exe"
  };

  const virusScanHook = async () => false; // File is infected

  await expect(saveFile(mockFile, {
    uploadDir: "./test-uploads",
    virusScanHook
  })).rejects.toThrow("File failed virus scan");

  // Cleanup
  await Bun.$`rm -rf ./test-uploads`;
});

test("saveFile handles progress tracking", async () => {
  const testContent = "x".repeat(100000); // 100KB file
  const mockFile: UploadedFile = {
    name: "large.txt",
    size: testContent.length,
    type: "text/plain",
    content: new Blob([testContent]),
    arrayBuffer: async () => new TextEncoder().encode(testContent).buffer,
    text: async () => testContent,
    stream: () => new ReadableStream({
      start(controller) {
        const bytes = new TextEncoder().encode(testContent);
        controller.enqueue(bytes);
        controller.close();
      }
    }),
    sanitizedName: "large.txt",
    isStreamable: true
  };

  const progressUpdates: Array<{ uploaded: number; total: number }> = [];
  const onProgress = (uploaded: number, total: number) => {
    progressUpdates.push({ uploaded, total });
  };

  await saveFile(mockFile, {
    uploadDir: "./test-uploads",
    enableStreaming: true,
    chunkSize: 1024,
    onProgress
  });

  expect(progressUpdates.length).toBeGreaterThan(0);
  expect(progressUpdates[progressUpdates.length - 1].uploaded).toBe(testContent.length);
  expect(progressUpdates[progressUpdates.length - 1].total).toBe(testContent.length);

  // Cleanup
  await Bun.$`rm -rf ./test-uploads`;
});

test("generateUniqueFileName uses sanitized name", () => {
  const name1 = generateUniqueFileName("../../../etc/passwd");
  const name2 = generateUniqueFileName("normal.txt");
  
  expect(name1).toMatch(/^\d+-[a-z0-9]{6}\.etc_passwd$/); // sanitized extension
  expect(name2).toMatch(/^\d+-[a-z0-9]{6}\.txt$/); // normal extension
  expect(name1).not.toBe(name2);
});