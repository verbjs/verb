# File Uploads

Verb provides comprehensive file upload handling with support for multipart forms, streaming uploads, validation, and progress tracking.

## Overview

File upload features:
- **Multipart Form Support**: Standard HTML form uploads
- **Streaming Uploads**: Large file handling with progress
- **File Validation**: Type, size, and content validation
- **Progress Tracking**: Real-time upload progress
- **Storage Options**: Local, cloud, and custom storage

## Basic File Upload

```typescript
import { createServer, middleware } from "verb";

const app = createServer();

// Enable multipart form handling
app.use(middleware.multipart({
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxFiles: 5,
  allowedTypes: ["image/*", "application/pdf"]
}));

app.post("/upload", async (req, res) => {
  try {
    const { files, fields } = req.files;
    
    if (!files.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    
    const file = files.file;
    const filename = `${Date.now()}-${file.name}`;
    const filepath = `./uploads/${filename}`;
    
    // Save file
    await Bun.write(filepath, file.stream());
    
    res.json({
      success: true,
      filename,
      size: file.size,
      type: file.type
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000);
```

## Multiple File Upload

Handle multiple files:

```typescript
app.post("/upload-multiple", async (req, res) => {
  try {
    const { files } = req.files;
    const uploadedFiles = [];
    
    // Handle multiple files with same field name
    const fileList = Array.isArray(files.files) ? files.files : [files.files];
    
    for (const file of fileList) {
      if (!file) continue;
      
      const filename = `${Date.now()}-${Math.random()}-${file.name}`;
      const filepath = `./uploads/${filename}`;
      
      await Bun.write(filepath, file.stream());
      
      uploadedFiles.push({
        originalName: file.name,
        filename,
        size: file.size,
        type: file.type
      });
    }
    
    res.json({
      success: true,
      files: uploadedFiles,
      count: uploadedFiles.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

## File Validation

Comprehensive file validation:

```typescript
const validateFile = (file) => {
  const errors = [];
  
  // Size validation
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    errors.push(`File too large. Max size: ${maxSize / 1024 / 1024}MB`);
  }
  
  // Type validation
  const allowedTypes = [
    "image/jpeg",
    "image/png", 
    "image/gif",
    "application/pdf",
    "text/plain"
  ];
  
  if (!allowedTypes.includes(file.type)) {
    errors.push(`Invalid file type. Allowed: ${allowedTypes.join(", ")}`);
  }
  
  // Filename validation
  const dangerousPatterns = [/\.\./, /\//, /\\/, /\0/];
  if (dangerousPatterns.some(pattern => pattern.test(file.name))) {
    errors.push("Invalid filename");
  }
  
  return errors;
};

app.post("/upload-validated", async (req, res) => {
  try {
    const { files } = req.files;
    const file = files.file;
    
    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    
    // Validate file
    const validationErrors = validateFile(file);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: "File validation failed",
        details: validationErrors
      });
    }
    
    // Additional content validation for images
    if (file.type.startsWith("image/")) {
      const isValidImage = await validateImageContent(file);
      if (!isValidImage) {
        return res.status(400).json({ error: "Invalid image file" });
      }
    }
    
    const filename = await saveFile(file);
    
    res.json({
      success: true,
      filename,
      size: file.size,
      type: file.type
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

async function validateImageContent(file) {
  try {
    // Read first few bytes to check magic numbers
    const buffer = new Uint8Array(await file.stream().getReader().read().then(r => r.value));
    
    // JPEG magic number: FF D8
    if (buffer[0] === 0xFF && buffer[1] === 0xD8) return true;
    
    // PNG magic number: 89 50 4E 47
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && 
        buffer[2] === 0x4E && buffer[3] === 0x47) return true;
    
    // GIF magic number: 47 49 46 38
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && 
        buffer[2] === 0x46 && buffer[3] === 0x38) return true;
    
    return false;
  } catch {
    return false;
  }
}
```

## Streaming Upload with Progress

Handle large files with progress tracking:

```typescript
app.post("/upload-stream", async (req, res) => {
  try {
    const contentLength = parseInt(req.headers.get("content-length") || "0");
    const uploadId = `upload_${Date.now()}`;
    
    let bytesReceived = 0;
    const filename = `./uploads/${uploadId}`;
    const file = Bun.file(filename);
    const writer = file.writer();
    
    // Store upload progress
    const progressStore = new Map();
    progressStore.set(uploadId, { bytesReceived: 0, totalBytes: contentLength });
    
    const reader = req.body?.getReader();
    if (!reader) {
      throw new Error("No request body");
    }
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        await writer.write(value);
        bytesReceived += value.length;
        
        // Update progress
        progressStore.set(uploadId, {
          bytesReceived,
          totalBytes: contentLength,
          percentage: Math.round((bytesReceived / contentLength) * 100)
        });
        
        // Emit progress event (WebSocket, SSE, etc.)
        emitProgress(uploadId, progressStore.get(uploadId));
      }
    } finally {
      await writer.end();
    }
    
    res.json({
      success: true,
      uploadId,
      filename,
      size: bytesReceived
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Progress endpoint
app.get("/upload-progress/:uploadId", (req, res) => {
  const { uploadId } = req.params;
  const progress = progressStore.get(uploadId);
  
  if (!progress) {
    return res.status(404).json({ error: "Upload not found" });
  }
  
  res.json(progress);
});
```

## Chunked Upload

Handle very large files with chunked uploads:

```typescript
const uploadSessions = new Map();

app.post("/upload-init", (req, res) => {
  const { filename, fileSize, chunkSize = 1024 * 1024 } = req.body; // 1MB chunks
  
  const sessionId = `session_${Date.now()}_${Math.random()}`;
  const totalChunks = Math.ceil(fileSize / chunkSize);
  
  uploadSessions.set(sessionId, {
    filename,
    fileSize,
    chunkSize,
    totalChunks,
    receivedChunks: new Set(),
    createdAt: Date.now()
  });
  
  res.json({
    sessionId,
    totalChunks,
    chunkSize
  });
});

app.post("/upload-chunk", async (req, res) => {
  try {
    const { sessionId, chunkIndex } = req.body;
    const session = uploadSessions.get(sessionId);
    
    if (!session) {
      return res.status(404).json({ error: "Upload session not found" });
    }
    
    const { files } = req.files;
    const chunk = files.chunk;
    
    if (!chunk) {
      return res.status(400).json({ error: "No chunk data" });
    }
    
    // Save chunk
    const chunkPath = `./uploads/chunks/${sessionId}_${chunkIndex}`;
    await Bun.write(chunkPath, chunk.stream());
    
    session.receivedChunks.add(parseInt(chunkIndex));
    
    const progress = (session.receivedChunks.size / session.totalChunks) * 100;
    
    res.json({
      success: true,
      chunkIndex: parseInt(chunkIndex),
      progress: Math.round(progress),
      received: session.receivedChunks.size,
      total: session.totalChunks
    });
    
    // Check if upload is complete
    if (session.receivedChunks.size === session.totalChunks) {
      await assembleChunks(sessionId, session);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

async function assembleChunks(sessionId, session) {
  const finalPath = `./uploads/${session.filename}`;
  const writer = Bun.file(finalPath).writer();
  
  try {
    for (let i = 0; i < session.totalChunks; i++) {
      const chunkPath = `./uploads/chunks/${sessionId}_${i}`;
      const chunkData = await Bun.file(chunkPath).arrayBuffer();
      await writer.write(new Uint8Array(chunkData));
      
      // Clean up chunk file
      await Bun.unlink(chunkPath);
    }
    
    await writer.end();
    
    // Mark session as complete
    session.completed = true;
    session.finalPath = finalPath;
    
    console.log(`Upload completed: ${session.filename}`);
  } catch (error) {
    console.error("Error assembling chunks:", error);
    throw error;
  }
}

app.get("/upload-status/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  const session = uploadSessions.get(sessionId);
  
  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }
  
  const progress = (session.receivedChunks.size / session.totalChunks) * 100;
  
  res.json({
    sessionId,
    progress: Math.round(progress),
    received: session.receivedChunks.size,
    total: session.totalChunks,
    completed: session.completed || false,
    filename: session.filename
  });
});
```

## Cloud Storage Integration

Upload to cloud storage:

```typescript
// AWS S3 Example
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

app.post("/upload-to-s3", async (req, res) => {
  try {
    const { files } = req.files;
    const file = files.file;
    
    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    
    const key = `uploads/${Date.now()}-${file.name}`;
    
    const command = new PutObjectCommand({
      Bucket: "your-bucket-name",
      Key: key,
      Body: file.stream(),
      ContentType: file.type,
      Metadata: {
        originalName: file.name,
        uploadedAt: new Date().toISOString()
      }
    });
    
    const result = await s3Client.send(command);
    
    res.json({
      success: true,
      key,
      etag: result.ETag,
      url: `https://your-bucket-name.s3.amazonaws.com/${key}`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Google Cloud Storage Example
import { Storage } from "@google-cloud/storage";

const storage = new Storage({
  projectId: "your-project-id",
  keyFilename: "path/to/service-account-key.json"
});

const bucket = storage.bucket("your-bucket-name");

app.post("/upload-to-gcs", async (req, res) => {
  try {
    const { files } = req.files;
    const file = files.file;
    
    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    
    const filename = `uploads/${Date.now()}-${file.name}`;
    const gcsFile = bucket.file(filename);
    
    const stream = gcsFile.createWriteStream({
      metadata: {
        contentType: file.type,
        metadata: {
          originalName: file.name
        }
      }
    });
    
    const reader = file.stream().getReader();
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        stream.write(Buffer.from(value));
      }
      
      stream.end();
      
      await new Promise((resolve, reject) => {
        stream.on("finish", resolve);
        stream.on("error", reject);
      });
      
      res.json({
        success: true,
        filename,
        url: `gs://${bucket.name}/${filename}`
      });
    } finally {
      reader.releaseLock();
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

## Image Processing

Process uploaded images:

```typescript
// Using sharp for image processing
import sharp from "sharp";

app.post("/upload-image", async (req, res) => {
  try {
    const { files } = req.files;
    const file = files.image;
    
    if (!file || !file.type.startsWith("image/")) {
      return res.status(400).json({ error: "Valid image file required" });
    }
    
    const originalFilename = `${Date.now()}-original-${file.name}`;
    const thumbnailFilename = `${Date.now()}-thumb-${file.name}`;
    
    // Save original
    await Bun.write(`./uploads/${originalFilename}`, file.stream());
    
    // Create thumbnail
    const imageBuffer = await file.arrayBuffer();
    const thumbnail = await sharp(Buffer.from(imageBuffer))
      .resize(200, 200, { fit: "cover" })
      .jpeg({ quality: 80 })
      .toBuffer();
    
    await Bun.write(`./uploads/${thumbnailFilename}`, thumbnail);
    
    // Get image metadata
    const metadata = await sharp(Buffer.from(imageBuffer)).metadata();
    
    res.json({
      success: true,
      files: {
        original: originalFilename,
        thumbnail: thumbnailFilename
      },
      metadata: {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        size: file.size
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

## Security Considerations

Secure file upload handling:

```typescript
// Secure upload middleware
const secureUpload = (options = {}) => {
  return async (req, res, next) => {
    try {
      // Check file count
      const maxFiles = options.maxFiles || 5;
      if (req.files?.files && Array.isArray(req.files.files) && 
          req.files.files.length > maxFiles) {
        return res.status(400).json({ error: `Too many files. Max: ${maxFiles}` });
      }
      
      // Virus scanning (integrate with ClamAV or similar)
      if (options.virusScan) {
        const scanResult = await scanForViruses(req.files);
        if (!scanResult.clean) {
          return res.status(400).json({ error: "File failed security scan" });
        }
      }
      
      // Rate limiting per user
      if (options.rateLimit) {
        const userUploads = await getUserUploadCount(req.user?.id);
        if (userUploads > options.rateLimit.max) {
          return res.status(429).json({ error: "Upload rate limit exceeded" });
        }
      }
      
      next();
    } catch (error) {
      res.status(500).json({ error: "Security check failed" });
    }
  };
};

// Sanitize filename
function sanitizeFilename(filename) {
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_+|_+$/g, "")
    .substring(0, 100); // Limit length
}

// Content type verification
function verifyContentType(file) {
  const allowedTypes = {
    "image/jpeg": [0xFF, 0xD8],
    "image/png": [0x89, 0x50, 0x4E, 0x47],
    "application/pdf": [0x25, 0x50, 0x44, 0x46]
  };
  
  const header = file.buffer.slice(0, 4);
  const signature = allowedTypes[file.type];
  
  if (!signature) return false;
  
  return signature.every((byte, index) => header[index] === byte);
}
```

## Testing File Uploads

Test upload functionality:

```typescript
import { test, expect } from "bun:test";

test("file upload", async () => {
  const formData = new FormData();
  const file = new File(["test content"], "test.txt", { type: "text/plain" });
  formData.append("file", file);
  
  const response = await fetch("http://localhost:3000/upload", {
    method: "POST",
    body: formData
  });
  
  expect(response.status).toBe(200);
  const result = await response.json();
  expect(result.success).toBe(true);
  expect(result.filename).toBeDefined();
});

test("file validation", async () => {
  const formData = new FormData();
  const largeFile = new File(["x".repeat(20 * 1024 * 1024)], "large.txt");
  formData.append("file", largeFile);
  
  const response = await fetch("http://localhost:3000/upload", {
    method: "POST",
    body: formData
  });
  
  expect(response.status).toBe(400);
  const result = await response.json();
  expect(result.error).toContain("too large");
});
```

## Best Practices

1. **Validate Everything**: File type, size, content, filename
2. **Use Streaming**: Handle large files with streams
3. **Implement Progress**: Provide upload progress feedback
4. **Secure Storage**: Store files outside web root
5. **Scan for Malware**: Implement virus scanning
6. **Rate Limiting**: Prevent abuse with rate limits
7. **Clean Up**: Remove temporary and failed uploads

## Next Steps

- [Security](/guide/security) - Security best practices
- [Performance](/guide/performance) - Optimization techniques
- [Testing](/guide/testing) - Testing strategies