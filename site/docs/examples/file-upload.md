# File Upload Example

Complete example of building a file upload service with Verb, including multiple upload methods, validation, storage, and processing.

## Overview

This example demonstrates building a comprehensive file upload system with:

- Multiple upload methods (multipart, base64, streaming)
- File validation and security checks
- Multiple storage backends (local, cloud)
- Image processing and thumbnails
- Progress tracking
- File metadata management
- Download and serving files

## Project Setup

```bash
# Create new project
mkdir file-upload-service
cd file-upload-service
bun init -y

# Install dependencies
bun install verb
bun install -D @types/bun typescript

# Install file handling packages
bun install multer sharp mime-types
bun install uuid bcryptjs jsonwebtoken
```

## Server Setup

```typescript
// server.ts
import { createServer } from "verb";
import { cors, json, staticFiles } from "verb/middleware";
import { uploadRouter } from "./src/routes/upload";
import { fileRouter } from "./src/routes/files";
import { authRouter } from "./src/routes/auth";
import { FileStorage } from "./src/services/FileStorage";
import { ImageProcessor } from "./src/services/ImageProcessor";

const app = createServer();

// Initialize services
const fileStorage = new FileStorage();
const imageProcessor = new ImageProcessor();

// Middleware
app.use(cors({
  origin: ["http://localhost:3000"],
  credentials: true
}));
app.use(json({ limit: "50mb" })); // Large limit for base64 uploads

// Serve uploaded files
app.use("/uploads", staticFiles({ 
  root: "./uploads",
  maxAge: "1d",
  setHeaders: (res, path) => {
    // Add security headers for file serving
    res.header("X-Content-Type-Options", "nosniff");
    res.header("Content-Disposition", "inline");
  }
}));

// API routes
app.use("/api/auth", authRouter);
app.use("/api/upload", uploadRouter);
app.use("/api/files", fileRouter);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "healthy", storage: fileStorage.getStats() });
});

// File upload demo page
app.get("/", (req, res) => {
  res.sendFile("./public/index.html");
});

const port = process.env.PORT || 3000;
app.listen(port);

console.log(`🚀 File Upload Service running on port ${port}`);
```

## File Upload Routes

```typescript
// src/routes/upload.ts
import { createServer } from "verb";
import { multer } from "verb/middleware";
import { authenticate } from "../middleware/auth";
import { validateFile } from "../middleware/validation";
import { FileService } from "../services/FileService";
import { ImageProcessor } from "../services/ImageProcessor";
import { asyncHandler } from "../middleware/asyncHandler";

const uploadRouter = createServer();

// Configure multer for different upload types
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = `./uploads/${new Date().getFullYear()}/${new Date().getMonth() + 1}`;
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5 // Max 5 files
  },
  fileFilter: (req, file, cb) => {
    // Basic file type validation
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt|mp4|avi|mov/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// Single file upload
uploadRouter.post("/single",
  authenticate,
  upload.single('file'),
  validateFile,
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    
    const userId = req.user.userId;
    const file = req.file;
    
    try {
      // Process and save file metadata
      const fileRecord = await FileService.create({
        userId,
        originalName: file.originalname,
        filename: file.filename,
        path: file.path,
        mimetype: file.mimetype,
        size: file.size,
        uploadType: "single"
      });
      
      // Process image if it's an image file
      if (file.mimetype.startsWith('image/')) {
        await ImageProcessor.generateThumbnails(fileRecord);
      }
      
      res.status(201).json({
        message: "File uploaded successfully",
        file: {
          id: fileRecord.id,
          originalName: fileRecord.originalName,
          size: fileRecord.size,
          mimetype: fileRecord.mimetype,
          url: `/uploads/${fileRecord.relativePath}`,
          thumbnails: fileRecord.thumbnails
        }
      });
    } catch (error) {
      console.error("File upload error:", error);
      res.status(500).json({ error: "Failed to process uploaded file" });
    }
  })
);

// Multiple file upload
uploadRouter.post("/multiple",
  authenticate,
  upload.array('files', 5),
  asyncHandler(async (req, res) => {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }
    
    const userId = req.user.userId;
    const files = req.files as Express.Multer.File[];
    const results = [];
    
    for (const file of files) {
      try {
        const fileRecord = await FileService.create({
          userId,
          originalName: file.originalname,
          filename: file.filename,
          path: file.path,
          mimetype: file.mimetype,
          size: file.size,
          uploadType: "multiple"
        });
        
        // Process image thumbnails
        if (file.mimetype.startsWith('image/')) {
          await ImageProcessor.generateThumbnails(fileRecord);
        }
        
        results.push({
          id: fileRecord.id,
          originalName: fileRecord.originalName,
          size: fileRecord.size,
          mimetype: fileRecord.mimetype,
          url: `/uploads/${fileRecord.relativePath}`,
          thumbnails: fileRecord.thumbnails
        });
      } catch (error) {
        console.error(`Error processing file ${file.originalname}:`, error);
        results.push({
          originalName: file.originalname,
          error: "Failed to process file"
        });
      }
    }
    
    res.status(201).json({
      message: `${results.length} files processed`,
      files: results
    });
  })
);

// Base64 file upload
uploadRouter.post("/base64",
  authenticate,
  asyncHandler(async (req, res) => {
    const { filename, data, mimetype } = req.body;
    
    if (!filename || !data || !mimetype) {
      return res.status(400).json({ 
        error: "filename, data, and mimetype are required" 
      });
    }
    
    try {
      // Decode base64 data
      const buffer = Buffer.from(data, 'base64');
      
      // Validate file size
      if (buffer.length > 10 * 1024 * 1024) { // 10MB
        return res.status(413).json({ error: "File too large" });
      }
      
      // Save file
      const savedFile = await FileService.saveBase64File({
        userId: req.user.userId,
        filename,
        buffer,
        mimetype
      });
      
      // Process image if needed
      if (mimetype.startsWith('image/')) {
        await ImageProcessor.generateThumbnails(savedFile);
      }
      
      res.status(201).json({
        message: "File uploaded successfully",
        file: {
          id: savedFile.id,
          originalName: savedFile.originalName,
          size: savedFile.size,
          mimetype: savedFile.mimetype,
          url: `/uploads/${savedFile.relativePath}`,
          thumbnails: savedFile.thumbnails
        }
      });
    } catch (error) {
      console.error("Base64 upload error:", error);
      res.status(500).json({ error: "Failed to process base64 file" });
    }
  })
);

// Chunked upload initialization
uploadRouter.post("/chunk/init",
  authenticate,
  asyncHandler(async (req, res) => {
    const { filename, totalSize, chunkSize, mimetype } = req.body;
    
    if (!filename || !totalSize || !chunkSize || !mimetype) {
      return res.status(400).json({
        error: "filename, totalSize, chunkSize, and mimetype are required"
      });
    }
    
    try {
      const uploadSession = await FileService.initChunkedUpload({
        userId: req.user.userId,
        filename,
        totalSize,
        chunkSize,
        mimetype
      });
      
      res.json({
        uploadId: uploadSession.id,
        totalChunks: uploadSession.totalChunks,
        chunkSize: uploadSession.chunkSize
      });
    } catch (error) {
      console.error("Chunked upload init error:", error);
      res.status(500).json({ error: "Failed to initialize chunked upload" });
    }
  })
);

// Chunked upload - upload chunk
uploadRouter.post("/chunk/:uploadId/:chunkIndex",
  authenticate,
  upload.single('chunk'),
  asyncHandler(async (req, res) => {
    const { uploadId, chunkIndex } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ error: "No chunk data uploaded" });
    }
    
    try {
      const result = await FileService.uploadChunk({
        uploadId,
        chunkIndex: parseInt(chunkIndex),
        chunkData: req.file.buffer || await Bun.file(req.file.path).arrayBuffer()
      });
      
      res.json({
        chunkIndex: parseInt(chunkIndex),
        uploaded: true,
        progress: result.progress,
        isComplete: result.isComplete,
        fileId: result.fileId
      });
    } catch (error) {
      console.error("Chunk upload error:", error);
      res.status(500).json({ error: "Failed to upload chunk" });
    }
  })
);

// Chunked upload - finalize
uploadRouter.post("/chunk/:uploadId/finalize",
  authenticate,
  asyncHandler(async (req, res) => {
    const { uploadId } = req.params;
    
    try {
      const finalizedFile = await FileService.finalizeChunkedUpload(uploadId);
      
      // Process image if needed
      if (finalizedFile.mimetype.startsWith('image/')) {
        await ImageProcessor.generateThumbnails(finalizedFile);
      }
      
      res.json({
        message: "Chunked upload completed successfully",
        file: {
          id: finalizedFile.id,
          originalName: finalizedFile.originalName,
          size: finalizedFile.size,
          mimetype: finalizedFile.mimetype,
          url: `/uploads/${finalizedFile.relativePath}`,
          thumbnails: finalizedFile.thumbnails
        }
      });
    } catch (error) {
      console.error("Finalize upload error:", error);
      res.status(500).json({ error: "Failed to finalize chunked upload" });
    }
  })
);

// Upload progress tracking
uploadRouter.get("/progress/:uploadId",
  authenticate,
  asyncHandler(async (req, res) => {
    const { uploadId } = req.params;
    
    try {
      const progress = await FileService.getUploadProgress(uploadId);
      res.json(progress);
    } catch (error) {
      res.status(404).json({ error: "Upload session not found" });
    }
  })
);

export { uploadRouter };
```

## File Management Routes

```typescript
// src/routes/files.ts
import { createServer } from "verb";
import { authenticate } from "../middleware/auth";
import { FileService } from "../services/FileService";
import { ImageProcessor } from "../services/ImageProcessor";
import { asyncHandler } from "../middleware/asyncHandler";

const fileRouter = createServer();

// Get user's files
fileRouter.get("/",
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const { page = 1, limit = 20, type, search } = req.query;
    
    const files = await FileService.getUserFiles({
      userId,
      page: parseInt(page),
      limit: parseInt(limit),
      type,
      search
    });
    
    res.json(files);
  })
);

// Get file by ID
fileRouter.get("/:id",
  authenticate,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId;
    
    const file = await FileService.getById(id);
    
    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }
    
    // Check ownership or public access
    if (file.userId !== userId && !file.isPublic) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    res.json({
      id: file.id,
      originalName: file.originalName,
      size: file.size,
      mimetype: file.mimetype,
      url: `/uploads/${file.relativePath}`,
      thumbnails: file.thumbnails,
      metadata: file.metadata,
      createdAt: file.createdAt
    });
  })
);

// Download file
fileRouter.get("/:id/download",
  authenticate,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId;
    
    const file = await FileService.getById(id);
    
    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }
    
    // Check permissions
    if (file.userId !== userId && !file.isPublic) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    // Update download count
    await FileService.incrementDownloadCount(id);
    
    // Set download headers
    res.header("Content-Disposition", `attachment; filename="${file.originalName}"`);
    res.header("Content-Type", file.mimetype);
    res.header("Content-Length", file.size.toString());
    
    // Stream file
    await res.sendFile(file.path);
  })
);

// Get file thumbnail
fileRouter.get("/:id/thumbnail/:size",
  asyncHandler(async (req, res) => {
    const { id, size } = req.params;
    
    const file = await FileService.getById(id);
    
    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }
    
    if (!file.mimetype.startsWith('image/')) {
      return res.status(400).json({ error: "File is not an image" });
    }
    
    try {
      const thumbnailPath = await ImageProcessor.getThumbnail(file, size);
      
      res.header("Content-Type", "image/jpeg");
      res.header("Cache-Control", "public, max-age=31536000"); // 1 year
      
      await res.sendFile(thumbnailPath);
    } catch (error) {
      res.status(404).json({ error: "Thumbnail not found" });
    }
  })
);

// Update file metadata
fileRouter.patch("/:id",
  authenticate,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId;
    const updates = req.body;
    
    const file = await FileService.getById(id);
    
    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }
    
    if (file.userId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    const updatedFile = await FileService.update(id, updates);
    
    res.json({
      message: "File updated successfully",
      file: updatedFile
    });
  })
);

// Delete file
fileRouter.delete("/:id",
  authenticate,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId;
    
    const file = await FileService.getById(id);
    
    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }
    
    if (file.userId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    await FileService.delete(id);
    
    res.json({ message: "File deleted successfully" });
  })
);

// Share file (make public)
fileRouter.post("/:id/share",
  authenticate,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId;
    const { expiresAt } = req.body;
    
    const shareLink = await FileService.createShareLink({
      fileId: id,
      userId,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined
    });
    
    res.json({
      message: "Share link created",
      shareLink: {
        id: shareLink.id,
        url: `/api/files/shared/${shareLink.token}`,
        expiresAt: shareLink.expiresAt
      }
    });
  })
);

// Access shared file
fileRouter.get("/shared/:token",
  asyncHandler(async (req, res) => {
    const { token } = req.params;
    
    try {
      const sharedFile = await FileService.getSharedFile(token);
      
      res.header("Content-Disposition", `inline; filename="${sharedFile.originalName}"`);
      res.header("Content-Type", sharedFile.mimetype);
      res.header("Cache-Control", "private, max-age=3600");
      
      await res.sendFile(sharedFile.path);
    } catch (error) {
      res.status(404).json({ error: "Shared file not found or expired" });
    }
  })
);

export { fileRouter };
```

## File Service Implementation

```typescript
// src/services/FileService.ts
import { Database } from "bun:sqlite";
import { promises as fs } from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import mime from "mime-types";

const db = new Database("files.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    original_name TEXT NOT NULL,
    filename TEXT NOT NULL,
    path TEXT NOT NULL,
    relative_path TEXT NOT NULL,
    mimetype TEXT NOT NULL,
    size INTEGER NOT NULL,
    upload_type TEXT DEFAULT 'single',
    is_public BOOLEAN DEFAULT FALSE,
    download_count INTEGER DEFAULT 0,
    metadata TEXT DEFAULT '{}',
    thumbnails TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE TABLE IF NOT EXISTS upload_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    total_size INTEGER NOT NULL,
    chunk_size INTEGER NOT NULL,
    total_chunks INTEGER NOT NULL,
    mimetype TEXT NOT NULL,
    uploaded_chunks TEXT DEFAULT '[]',
    temp_dir TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE TABLE IF NOT EXISTS share_links (
    id TEXT PRIMARY KEY,
    file_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (file_id) REFERENCES files (id) ON DELETE CASCADE
  );
  
  CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id);
  CREATE INDEX IF NOT EXISTS idx_files_mimetype ON files(mimetype);
  CREATE INDEX IF NOT EXISTS idx_share_links_token ON share_links(token);
`);

export class FileService {
  static async create(fileData: {
    userId: string;
    originalName: string;
    filename: string;
    path: string;
    mimetype: string;
    size: number;
    uploadType?: string;
  }) {
    const id = uuidv4();
    const relativePath = path.relative('./uploads', fileData.path);
    
    db.query(`
      INSERT INTO files (
        id, user_id, original_name, filename, path, relative_path,
        mimetype, size, upload_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      fileData.userId,
      fileData.originalName,
      fileData.filename,
      fileData.path,
      relativePath,
      fileData.mimetype,
      fileData.size,
      fileData.uploadType || 'single'
    );
    
    return this.getById(id);
  }
  
  static async saveBase64File(data: {
    userId: string;
    filename: string;
    buffer: Buffer;
    mimetype: string;
  }) {
    // Create upload directory
    const uploadDir = `./uploads/${new Date().getFullYear()}/${new Date().getMonth() + 1}`;
    await fs.mkdir(uploadDir, { recursive: true });
    
    // Generate unique filename
    const ext = mime.extension(data.mimetype) || 'bin';
    const uniqueFilename = `${Date.now()}-${Math.round(Math.random() * 1E9)}.${ext}`;
    const filePath = path.join(uploadDir, uniqueFilename);
    
    // Save file
    await fs.writeFile(filePath, data.buffer);
    
    return this.create({
      userId: data.userId,
      originalName: data.filename,
      filename: uniqueFilename,
      path: filePath,
      mimetype: data.mimetype,
      size: data.buffer.length,
      uploadType: 'base64'
    });
  }
  
  static async initChunkedUpload(data: {
    userId: string;
    filename: string;
    totalSize: number;
    chunkSize: number;
    mimetype: string;
  }) {
    const id = uuidv4();
    const totalChunks = Math.ceil(data.totalSize / data.chunkSize);
    const tempDir = `./temp/${id}`;
    
    await fs.mkdir(tempDir, { recursive: true });
    
    db.query(`
      INSERT INTO upload_sessions (
        id, user_id, filename, total_size, chunk_size, total_chunks,
        mimetype, temp_dir
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.userId,
      data.filename,
      data.totalSize,
      data.chunkSize,
      totalChunks,
      data.mimetype,
      tempDir
    );
    
    return { id, totalChunks, chunkSize: data.chunkSize };
  }
  
  static async uploadChunk(data: {
    uploadId: string;
    chunkIndex: number;
    chunkData: ArrayBuffer;
  }) {
    const session = db.query(`
      SELECT * FROM upload_sessions WHERE id = ?
    `).get(data.uploadId) as any;
    
    if (!session) {
      throw new Error("Upload session not found");
    }
    
    // Save chunk
    const chunkPath = path.join(session.temp_dir, `chunk_${data.chunkIndex}`);
    await fs.writeFile(chunkPath, Buffer.from(data.chunkData));
    
    // Update uploaded chunks
    const uploadedChunks = JSON.parse(session.uploaded_chunks);
    uploadedChunks.push(data.chunkIndex);
    
    db.query(`
      UPDATE upload_sessions SET uploaded_chunks = ? WHERE id = ?
    `).run(JSON.stringify(uploadedChunks), data.uploadId);
    
    const progress = (uploadedChunks.length / session.total_chunks) * 100;
    const isComplete = uploadedChunks.length === session.total_chunks;
    
    return {
      progress,
      isComplete,
      fileId: isComplete ? await this.finalizeChunkedUpload(data.uploadId) : null
    };
  }
  
  static async finalizeChunkedUpload(uploadId: string) {
    const session = db.query(`
      SELECT * FROM upload_sessions WHERE id = ?
    `).get(uploadId) as any;
    
    if (!session) {
      throw new Error("Upload session not found");
    }
    
    // Create final upload directory
    const uploadDir = `./uploads/${new Date().getFullYear()}/${new Date().getMonth() + 1}`;
    await fs.mkdir(uploadDir, { recursive: true });
    
    // Generate final filename
    const ext = mime.extension(session.mimetype) || 'bin';
    const finalFilename = `${Date.now()}-${Math.round(Math.random() * 1E9)}.${ext}`;
    const finalPath = path.join(uploadDir, finalFilename);
    
    // Combine chunks
    const writeStream = Bun.file(finalPath).writer();
    
    for (let i = 0; i < session.total_chunks; i++) {
      const chunkPath = path.join(session.temp_dir, `chunk_${i}`);
      const chunkData = await fs.readFile(chunkPath);
      writeStream.write(chunkData);
    }
    
    await writeStream.end();
    
    // Create file record
    const fileRecord = await this.create({
      userId: session.user_id,
      originalName: session.filename,
      filename: finalFilename,
      path: finalPath,
      mimetype: session.mimetype,
      size: session.total_size,
      uploadType: 'chunked'
    });
    
    // Clean up temp files
    await fs.rm(session.temp_dir, { recursive: true, force: true });
    
    // Remove upload session
    db.query("DELETE FROM upload_sessions WHERE id = ?").run(uploadId);
    
    return fileRecord;
  }
  
  static async getById(id: string) {
    const file = db.query("SELECT * FROM files WHERE id = ?").get(id) as any;
    return file ? this.mapFileRecord(file) : null;
  }
  
  static async getUserFiles(options: {
    userId: string;
    page: number;
    limit: number;
    type?: string;
    search?: string;
  }) {
    let query = "SELECT * FROM files WHERE user_id = ?";
    const params = [options.userId];
    
    if (options.type) {
      query += " AND mimetype LIKE ?";
      params.push(`${options.type}/%`);
    }
    
    if (options.search) {
      query += " AND original_name LIKE ?";
      params.push(`%${options.search}%`);
    }
    
    // Count total
    const countQuery = query.replace("SELECT *", "SELECT COUNT(*) as count");
    const countResult = db.query(countQuery).get(...params) as any;
    const total = countResult.count;
    
    // Add pagination
    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    params.push(options.limit, (options.page - 1) * options.limit);
    
    const files = db.query(query).all(...params).map(this.mapFileRecord);
    
    return {
      files,
      pagination: {
        page: options.page,
        limit: options.limit,
        total,
        pages: Math.ceil(total / options.limit)
      }
    };
  }
  
  static async update(id: string, updates: any) {
    const allowedUpdates = ['original_name', 'is_public', 'metadata'];
    const setClause = [];
    const params = [];
    
    for (const [key, value] of Object.entries(updates)) {
      if (allowedUpdates.includes(key)) {
        setClause.push(`${key} = ?`);
        params.push(typeof value === 'object' ? JSON.stringify(value) : value);
      }
    }
    
    if (setClause.length === 0) {
      throw new Error("No valid updates provided");
    }
    
    setClause.push("updated_at = CURRENT_TIMESTAMP");
    params.push(id);
    
    db.query(`
      UPDATE files SET ${setClause.join(", ")} WHERE id = ?
    `).run(...params);
    
    return this.getById(id);
  }
  
  static async delete(id: string) {
    const file = await this.getById(id);
    if (!file) {
      throw new Error("File not found");
    }
    
    // Delete physical file
    try {
      await fs.unlink(file.path);
      
      // Delete thumbnails if they exist
      if (file.thumbnails) {
        for (const thumbnail of Object.values(file.thumbnails)) {
          try {
            await fs.unlink(thumbnail as string);
          } catch (e) {
            // Ignore thumbnail deletion errors
          }
        }
      }
    } catch (error) {
      console.error("Error deleting physical file:", error);
    }
    
    // Delete database record
    db.query("DELETE FROM files WHERE id = ?").run(id);
  }
  
  static async incrementDownloadCount(id: string) {
    db.query(`
      UPDATE files SET download_count = download_count + 1 WHERE id = ?
    `).run(id);
  }
  
  static async createShareLink(data: {
    fileId: string;
    userId: string;
    expiresAt?: Date;
  }) {
    const token = uuidv4();
    const id = uuidv4();
    
    db.query(`
      INSERT INTO share_links (id, file_id, user_id, token, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, data.fileId, data.userId, token, data.expiresAt?.toISOString());
    
    return { id, token, expiresAt: data.expiresAt };
  }
  
  static async getSharedFile(token: string) {
    const shareLink = db.query(`
      SELECT sl.*, f.* FROM share_links sl
      JOIN files f ON sl.file_id = f.id
      WHERE sl.token = ? AND (sl.expires_at IS NULL OR sl.expires_at > CURRENT_TIMESTAMP)
    `).get(token) as any;
    
    if (!shareLink) {
      throw new Error("Shared file not found or expired");
    }
    
    return this.mapFileRecord(shareLink);
  }
  
  static async getUploadProgress(uploadId: string) {
    const session = db.query(`
      SELECT * FROM upload_sessions WHERE id = ?
    `).get(uploadId) as any;
    
    if (!session) {
      throw new Error("Upload session not found");
    }
    
    const uploadedChunks = JSON.parse(session.uploaded_chunks);
    const progress = (uploadedChunks.length / session.total_chunks) * 100;
    
    return {
      uploadId,
      progress,
      uploadedChunks: uploadedChunks.length,
      totalChunks: session.total_chunks,
      isComplete: uploadedChunks.length === session.total_chunks
    };
  }
  
  private static mapFileRecord(file: any) {
    return {
      id: file.id,
      userId: file.user_id,
      originalName: file.original_name,
      filename: file.filename,
      path: file.path,
      relativePath: file.relative_path,
      mimetype: file.mimetype,
      size: file.size,
      uploadType: file.upload_type,
      isPublic: file.is_public,
      downloadCount: file.download_count,
      metadata: JSON.parse(file.metadata || '{}'),
      thumbnails: JSON.parse(file.thumbnails || '{}'),
      createdAt: file.created_at,
      updatedAt: file.updated_at
    };
  }
}
```

## Image Processing Service

```typescript
// src/services/ImageProcessor.ts
import sharp from "sharp";
import path from "path";
import { promises as fs } from "fs";
import { Database } from "bun:sqlite";

const db = new Database("files.db");

export class ImageProcessor {
  static thumbnailSizes = {
    small: { width: 150, height: 150 },
    medium: { width: 300, height: 300 },
    large: { width: 600, height: 600 }
  };
  
  static async generateThumbnails(file: any) {
    if (!file.mimetype.startsWith('image/')) {
      return;
    }
    
    const thumbnails: any = {};
    const thumbnailDir = path.join(path.dirname(file.path), 'thumbnails');
    
    // Create thumbnails directory
    await fs.mkdir(thumbnailDir, { recursive: true });
    
    try {
      const image = sharp(file.path);
      const metadata = await image.metadata();
      
      // Generate different sized thumbnails
      for (const [size, dimensions] of Object.entries(this.thumbnailSizes)) {
        const thumbnailPath = path.join(
          thumbnailDir,
          `${path.parse(file.filename).name}_${size}.jpg`
        );
        
        await image
          .resize(dimensions.width, dimensions.height, {
            fit: 'cover',
            position: 'center'
          })
          .jpeg({ quality: 85 })
          .toFile(thumbnailPath);
        
        thumbnails[size] = path.relative('./uploads', thumbnailPath);
      }
      
      // Update file record with thumbnails
      db.query(`
        UPDATE files SET thumbnails = ?, metadata = ? WHERE id = ?
      `).run(
        JSON.stringify(thumbnails),
        JSON.stringify({
          ...file.metadata,
          imageInfo: {
            width: metadata.width,
            height: metadata.height,
            format: metadata.format,
            hasAlpha: metadata.hasAlpha
          }
        }),
        file.id
      );
      
    } catch (error) {
      console.error("Error generating thumbnails:", error);
    }
  }
  
  static async getThumbnail(file: any, size: string) {
    const thumbnails = file.thumbnails || {};
    
    if (!thumbnails[size]) {
      throw new Error("Thumbnail not found");
    }
    
    return path.join('./uploads', thumbnails[size]);
  }
  
  static async resizeImage(inputPath: string, outputPath: string, options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'jpeg' | 'png' | 'webp';
  }) {
    const image = sharp(inputPath);
    
    if (options.width || options.height) {
      image.resize(options.width, options.height, {
        fit: 'inside',
        withoutEnlargement: true
      });
    }
    
    switch (options.format) {
      case 'jpeg':
        image.jpeg({ quality: options.quality || 85 });
        break;
      case 'png':
        image.png({ quality: options.quality || 85 });
        break;
      case 'webp':
        image.webp({ quality: options.quality || 85 });
        break;
    }
    
    await image.toFile(outputPath);
  }
  
  static async optimizeImage(file: any) {
    if (!file.mimetype.startsWith('image/')) {
      return;
    }
    
    const optimizedDir = path.join(path.dirname(file.path), 'optimized');
    await fs.mkdir(optimizedDir, { recursive: true });
    
    const optimizedPath = path.join(
      optimizedDir,
      `${path.parse(file.filename).name}_optimized.jpg`
    );
    
    try {
      await sharp(file.path)
        .jpeg({ quality: 80, progressive: true })
        .toFile(optimizedPath);
      
      const optimizedStats = await fs.stat(optimizedPath);
      const originalStats = await fs.stat(file.path);
      
      const savings = ((originalStats.size - optimizedStats.size) / originalStats.size) * 100;
      
      console.log(`Image optimized: ${savings.toFixed(1)}% size reduction`);
      
      return {
        optimizedPath,
        originalSize: originalStats.size,
        optimizedSize: optimizedStats.size,
        savings: savings
      };
    } catch (error) {
      console.error("Error optimizing image:", error);
      throw error;
    }
  }
}
```

## Frontend Upload Interface

```html
<!-- public/index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>File Upload Demo</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f5f5;
            padding: 20px;
        }
        
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border-radius: 10px;
            padding: 30px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        .upload-section {
            margin-bottom: 40px;
            padding: 20px;
            border: 2px dashed #ddd;
            border-radius: 8px;
            text-align: center;
        }
        
        .upload-section.dragover {
            border-color: #007bff;
            background: #f8f9ff;
        }
        
        .file-input {
            display: none;
        }
        
        .upload-btn {
            padding: 12px 24px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 16px;
            margin: 10px;
        }
        
        .upload-btn:hover {
            background: #0056b3;
        }
        
        .progress-bar {
            width: 100%;
            height: 20px;
            background: #e9ecef;
            border-radius: 10px;
            overflow: hidden;
            margin: 10px 0;
        }
        
        .progress-fill {
            height: 100%;
            background: #28a745;
            width: 0%;
            transition: width 0.3s ease;
        }
        
        .file-list {
            margin-top: 20px;
        }
        
        .file-item {
            display: flex;
            align-items: center;
            padding: 10px;
            border: 1px solid #eee;
            border-radius: 6px;
            margin-bottom: 10px;
        }
        
        .file-info {
            flex: 1;
        }
        
        .file-name {
            font-weight: bold;
            margin-bottom: 5px;
        }
        
        .file-meta {
            font-size: 12px;
            color: #666;
        }
        
        .file-actions {
            display: flex;
            gap: 10px;
        }
        
        .btn {
            padding: 6px 12px;
            border: 1px solid #ddd;
            background: white;
            border-radius: 4px;
            cursor: pointer;
            text-decoration: none;
            font-size: 12px;
        }
        
        .btn-danger {
            background: #dc3545;
            color: white;
            border-color: #dc3545;
        }
        
        .thumbnail {
            width: 50px;
            height: 50px;
            object-fit: cover;
            border-radius: 4px;
            margin-right: 10px;
        }
        
        .auth-section {
            margin-bottom: 20px;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 6px;
        }
        
        .auth-form input {
            padding: 8px 12px;
            border: 1px solid #ddd;
            border-radius: 4px;
            margin-right: 10px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>File Upload Demo</h1>
        
        <div id="authSection" class="auth-section">
            <h3>Authentication</h3>
            <div class="auth-form">
                <input type="text" id="username" placeholder="Username" value="demo">
                <input type="password" id="password" placeholder="Password" value="demo123">
                <button class="upload-btn" onclick="login()">Login</button>
                <span id="authStatus"></span>
            </div>
        </div>
        
        <div id="uploadSections" style="display: none;">
            <!-- Single File Upload -->
            <div class="upload-section" id="singleUpload">
                <h3>Single File Upload</h3>
                <p>Drag and drop a file here, or click to select</p>
                <input type="file" id="singleFileInput" class="file-input">
                <button class="upload-btn" onclick="document.getElementById('singleFileInput').click()">
                    Choose File
                </button>
                <button class="upload-btn" onclick="uploadSingle()">Upload</button>
                <div id="singleProgress" class="progress-bar" style="display: none;">
                    <div class="progress-fill"></div>
                </div>
            </div>
            
            <!-- Multiple File Upload -->
            <div class="upload-section" id="multipleUpload">
                <h3>Multiple File Upload</h3>
                <p>Select multiple files to upload at once</p>
                <input type="file" id="multipleFileInput" class="file-input" multiple>
                <button class="upload-btn" onclick="document.getElementById('multipleFileInput').click()">
                    Choose Files
                </button>
                <button class="upload-btn" onclick="uploadMultiple()">Upload All</button>
                <div id="multipleProgress" class="progress-bar" style="display: none;">
                    <div class="progress-fill"></div>
                </div>
            </div>
            
            <!-- Base64 Upload -->
            <div class="upload-section">
                <h3>Base64 Upload</h3>
                <p>Upload file as base64 encoded data</p>
                <input type="file" id="base64FileInput" class="file-input">
                <button class="upload-btn" onclick="document.getElementById('base64FileInput').click()">
                    Choose File
                </button>
                <button class="upload-btn" onclick="uploadBase64()">Upload as Base64</button>
                <div id="base64Progress" class="progress-bar" style="display: none;">
                    <div class="progress-fill"></div>
                </div>
            </div>
            
            <!-- Chunked Upload -->
            <div class="upload-section">
                <h3>Chunked Upload</h3>
                <p>Upload large files in chunks (for files > 5MB)</p>
                <input type="file" id="chunkedFileInput" class="file-input">
                <button class="upload-btn" onclick="document.getElementById('chunkedFileInput').click()">
                    Choose Large File
                </button>
                <button class="upload-btn" onclick="uploadChunked()">Upload in Chunks</button>
                <div id="chunkedProgress" class="progress-bar" style="display: none;">
                    <div class="progress-fill"></div>
                </div>
            </div>
            
            <!-- File List -->
            <div class="file-list">
                <h3>Uploaded Files</h3>
                <div id="fileList"></div>
                <button class="upload-btn" onclick="loadFiles()">Refresh List</button>
            </div>
        </div>
    </div>

    <script>
        let authToken = null;
        
        // Authentication
        async function login() {
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            
            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                
                if (response.ok) {
                    const data = await response.json();
                    authToken = data.token;
                    document.getElementById('authStatus').textContent = `Logged in as ${data.user.username}`;
                    document.getElementById('uploadSections').style.display = 'block';
                    loadFiles();
                } else {
                    document.getElementById('authStatus').textContent = 'Login failed';
                }
            } catch (error) {
                console.error('Login error:', error);
                document.getElementById('authStatus').textContent = 'Login error';
            }
        }
        
        // Single file upload
        async function uploadSingle() {
            const fileInput = document.getElementById('singleFileInput');
            const file = fileInput.files[0];
            
            if (!file) {
                alert('Please select a file');
                return;
            }
            
            const formData = new FormData();
            formData.append('file', file);
            
            const progressBar = document.getElementById('singleProgress');
            progressBar.style.display = 'block';
            
            try {
                const response = await fetch('/api/upload/single', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${authToken}`
                    },
                    body: formData
                });
                
                if (response.ok) {
                    const data = await response.json();
                    console.log('Upload successful:', data);
                    loadFiles();
                    fileInput.value = '';
                } else {
                    const error = await response.json();
                    alert('Upload failed: ' + error.error);
                }
            } catch (error) {
                console.error('Upload error:', error);
                alert('Upload error');
            } finally {
                progressBar.style.display = 'none';
            }
        }
        
        // Multiple file upload
        async function uploadMultiple() {
            const fileInput = document.getElementById('multipleFileInput');
            const files = fileInput.files;
            
            if (files.length === 0) {
                alert('Please select files');
                return;
            }
            
            const formData = new FormData();
            for (let i = 0; i < files.length; i++) {
                formData.append('files', files[i]);
            }
            
            const progressBar = document.getElementById('multipleProgress');
            progressBar.style.display = 'block';
            
            try {
                const response = await fetch('/api/upload/multiple', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${authToken}`
                    },
                    body: formData
                });
                
                if (response.ok) {
                    const data = await response.json();
                    console.log('Upload successful:', data);
                    loadFiles();
                    fileInput.value = '';
                } else {
                    const error = await response.json();
                    alert('Upload failed: ' + error.error);
                }
            } catch (error) {
                console.error('Upload error:', error);
                alert('Upload error');
            } finally {
                progressBar.style.display = 'none';
            }
        }
        
        // Base64 upload
        async function uploadBase64() {
            const fileInput = document.getElementById('base64FileInput');
            const file = fileInput.files[0];
            
            if (!file) {
                alert('Please select a file');
                return;
            }
            
            const progressBar = document.getElementById('base64Progress');
            progressBar.style.display = 'block';
            
            try {
                // Convert file to base64
                const base64Data = await fileToBase64(file);
                
                const response = await fetch('/api/upload/base64', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authToken}`
                    },
                    body: JSON.stringify({
                        filename: file.name,
                        data: base64Data,
                        mimetype: file.type
                    })
                });
                
                if (response.ok) {
                    const data = await response.json();
                    console.log('Upload successful:', data);
                    loadFiles();
                    fileInput.value = '';
                } else {
                    const error = await response.json();
                    alert('Upload failed: ' + error.error);
                }
            } catch (error) {
                console.error('Upload error:', error);
                alert('Upload error');
            } finally {
                progressBar.style.display = 'none';
            }
        }
        
        // Chunked upload
        async function uploadChunked() {
            const fileInput = document.getElementById('chunkedFileInput');
            const file = fileInput.files[0];
            
            if (!file) {
                alert('Please select a file');
                return;
            }
            
            const chunkSize = 1024 * 1024; // 1MB chunks
            const totalChunks = Math.ceil(file.size / chunkSize);
            
            const progressBar = document.getElementById('chunkedProgress');
            const progressFill = progressBar.querySelector('.progress-fill');
            progressBar.style.display = 'block';
            
            try {
                // Initialize chunked upload
                const initResponse = await fetch('/api/upload/chunk/init', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authToken}`
                    },
                    body: JSON.stringify({
                        filename: file.name,
                        totalSize: file.size,
                        chunkSize: chunkSize,
                        mimetype: file.type
                    })
                });
                
                const { uploadId } = await initResponse.json();
                
                // Upload chunks
                for (let i = 0; i < totalChunks; i++) {
                    const start = i * chunkSize;
                    const end = Math.min(start + chunkSize, file.size);
                    const chunk = file.slice(start, end);
                    
                    const formData = new FormData();
                    formData.append('chunk', chunk);
                    
                    const chunkResponse = await fetch(`/api/upload/chunk/${uploadId}/${i}`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${authToken}`
                        },
                        body: formData
                    });
                    
                    const chunkData = await chunkResponse.json();
                    
                    // Update progress
                    progressFill.style.width = chunkData.progress + '%';
                }
                
                // Finalize upload
                const finalizeResponse = await fetch(`/api/upload/chunk/${uploadId}/finalize`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${authToken}`
                    }
                });
                
                if (finalizeResponse.ok) {
                    const data = await finalizeResponse.json();
                    console.log('Chunked upload successful:', data);
                    loadFiles();
                    fileInput.value = '';
                } else {
                    const error = await finalizeResponse.json();
                    alert('Upload failed: ' + error.error);
                }
            } catch (error) {
                console.error('Upload error:', error);
                alert('Upload error');
            } finally {
                progressBar.style.display = 'none';
                progressFill.style.width = '0%';
            }
        }
        
        // Load user files
        async function loadFiles() {
            try {
                const response = await fetch('/api/files', {
                    headers: {
                        'Authorization': `Bearer ${authToken}`
                    }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    displayFiles(data.files);
                }
            } catch (error) {
                console.error('Error loading files:', error);
            }
        }
        
        // Display files
        function displayFiles(files) {
            const fileList = document.getElementById('fileList');
            fileList.innerHTML = '';
            
            files.forEach(file => {
                const fileItem = document.createElement('div');
                fileItem.className = 'file-item';
                
                const isImage = file.mimetype.startsWith('image/');
                const thumbnailHtml = isImage && file.thumbnails?.small ? 
                    `<img src="/uploads/${file.thumbnails.small}" class="thumbnail" alt="Thumbnail">` : '';
                
                fileItem.innerHTML = `
                    ${thumbnailHtml}
                    <div class="file-info">
                        <div class="file-name">${file.originalName}</div>
                        <div class="file-meta">
                            ${formatFileSize(file.size)} • ${file.mimetype} • ${new Date(file.createdAt).toLocaleDateString()}
                        </div>
                    </div>
                    <div class="file-actions">
                        <a href="/api/files/${file.id}/download" class="btn">Download</a>
                        ${isImage ? `<a href="/uploads/${file.relativePath}" target="_blank" class="btn">View</a>` : ''}
                        <button class="btn btn-danger" onclick="deleteFile('${file.id}')">Delete</button>
                    </div>
                `;
                
                fileList.appendChild(fileItem);
            });
        }
        
        // Delete file
        async function deleteFile(fileId) {
            if (!confirm('Are you sure you want to delete this file?')) {
                return;
            }
            
            try {
                const response = await fetch(`/api/files/${fileId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${authToken}`
                    }
                });
                
                if (response.ok) {
                    loadFiles();
                } else {
                    alert('Failed to delete file');
                }
            } catch (error) {
                console.error('Delete error:', error);
                alert('Delete error');
            }
        }
        
        // Utility functions
        function fileToBase64(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => {
                    const base64 = reader.result.split(',')[1];
                    resolve(base64);
                };
                reader.onerror = error => reject(error);
            });
        }
        
        function formatFileSize(bytes) {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        }
        
        // Drag and drop functionality
        function setupDragAndDrop() {
            const uploadSections = document.querySelectorAll('.upload-section');
            
            uploadSections.forEach(section => {
                section.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    section.classList.add('dragover');
                });
                
                section.addEventListener('dragleave', (e) => {
                    e.preventDefault();
                    section.classList.remove('dragover');
                });
                
                section.addEventListener('drop', (e) => {
                    e.preventDefault();
                    section.classList.remove('dragover');
                    
                    const files = e.dataTransfer.files;
                    if (files.length > 0) {
                        // Handle dropped files based on section
                        if (section.id === 'singleUpload') {
                            document.getElementById('singleFileInput').files = files;
                        } else if (section.id === 'multipleUpload') {
                            document.getElementById('multipleFileInput').files = files;
                        }
                    }
                });
            });
        }
        
        // Initialize
        document.addEventListener('DOMContentLoaded', () => {
            setupDragAndDrop();
        });
    </script>
</body>
</html>
```

## Testing File Upload

```typescript
// tests/file-upload.test.ts
import { test, expect, beforeAll, afterAll } from "bun:test";
import request from "supertest";
import { app } from "../server";
import path from "path";
import fs from "fs";

let authToken: string;

beforeAll(async () => {
  // Create test user and get auth token
  const response = await request(app)
    .post("/api/auth/register")
    .send({
      username: "testuser",
      password: "password123",
      email: "test@example.com"
    });
    
  authToken = response.body.token;
});

test("uploads single file successfully", async () => {
  const testFile = path.join(__dirname, "fixtures", "test-image.jpg");
  
  const response = await request(app)
    .post("/api/upload/single")
    .set("Authorization", `Bearer ${authToken}`)
    .attach("file", testFile)
    .expect(201);
    
  expect(response.body.message).toBe("File uploaded successfully");
  expect(response.body.file.originalName).toBe("test-image.jpg");
  expect(response.body.file.mimetype).toBe("image/jpeg");
});

test("uploads multiple files successfully", async () => {
  const testFile1 = path.join(__dirname, "fixtures", "test-image.jpg");
  const testFile2 = path.join(__dirname, "fixtures", "test-document.pdf");
  
  const response = await request(app)
    .post("/api/upload/multiple")
    .set("Authorization", `Bearer ${authToken}`)
    .attach("files", testFile1)
    .attach("files", testFile2)
    .expect(201);
    
  expect(response.body.files).toHaveLength(2);
});

test("rejects oversized files", async () => {
  const largeFile = Buffer.alloc(15 * 1024 * 1024); // 15MB
  
  await request(app)
    .post("/api/upload/single")
    .set("Authorization", `Bearer ${authToken}`)
    .attach("file", largeFile, "large-file.bin")
    .expect(413);
});

test("downloads uploaded file", async () => {
  // First upload a file
  const testFile = path.join(__dirname, "fixtures", "test-document.pdf");
  
  const uploadResponse = await request(app)
    .post("/api/upload/single")
    .set("Authorization", `Bearer ${authToken}`)
    .attach("file", testFile);
    
  const fileId = uploadResponse.body.file.id;
  
  // Then download it
  const downloadResponse = await request(app)
    .get(`/api/files/${fileId}/download`)
    .set("Authorization", `Bearer ${authToken}`)
    .expect(200);
    
  expect(downloadResponse.headers["content-type"]).toBe("application/pdf");
  expect(downloadResponse.headers["content-disposition"]).toContain("attachment");
});
```

## Environment Configuration

```bash
# .env
PORT=3000
NODE_ENV=development

# JWT
JWT_SECRET=your-secret-key

# Upload limits
MAX_FILE_SIZE=10485760  # 10MB
MAX_FILES=5

# Storage
UPLOAD_DIR=./uploads
TEMP_DIR=./temp

# Image processing
THUMBNAIL_QUALITY=85
```

## Key Features Demonstrated

This file upload example showcases:

1. **Multiple Upload Methods**: Single, multiple, base64, and chunked uploads
2. **File Validation**: Type, size, and security validation
3. **Image Processing**: Thumbnail generation and optimization
4. **Progress Tracking**: Real-time upload progress
5. **Storage Management**: Organized file storage with metadata
6. **Security**: Authentication, file type validation, and access control
7. **File Serving**: Secure file serving with proper headers
8. **Share Links**: Public file sharing with expiration
9. **Drag & Drop**: Modern file upload UI
10. **Testing**: Comprehensive upload testing

## See Also

- [REST API Example](/examples/rest-api) - API design patterns
- [Authentication Example](/examples/authentication) - User authentication
- [Middleware Guide](/guide/middleware) - File upload middleware
- [Security Guide](/guide/security) - File upload security