import { createServer, saveFile, validateFile, generateUniqueFileName, type UploadedFile } from '../../src/index';
import type { VerbRequest, VerbResponse } from '../../src/index';

const app = createServer();

// Serve the upload form
app.get('/', async (_req: VerbRequest, res: VerbResponse) => {
  const html = await Bun.file('examples/file-upload/upload.html').text();
  res.html(html);
});

// Single file upload endpoint
app.post('/upload/single', async (req: VerbRequest, res: VerbResponse) => {
  try {
    if (!req.formData) {
      return res.status(400).json({ error: 'No form data found' });
    }

    const formDataResult = await req.formData!() as unknown as { fields: Record<string, string>; files: Record<string, any> };
    const fields = formDataResult.fields;
    const files = formDataResult.files;
    const uploadedFile = files.file as UploadedFile;
    
    if (!uploadedFile) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Validate file
    const validation = validateFile(uploadedFile, {
      maxFileSize: 10 * 1024 * 1024, // 10MB
      allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'text/plain', 'application/pdf']
    });

    if (!validation.valid) {
      return res.status(400).json({ 
        error: 'File validation failed', 
        details: validation.errors 
      });
    }

    // Save file
    const savedFile = await saveFile(uploadedFile, {
      uploadDir: './uploads',
      generateFileName: generateUniqueFileName
    });

    return res.json({
      message: 'File uploaded successfully',
      name: fields.name,
      file: savedFile
    });

  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ 
      error: 'Upload failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Multiple files upload endpoint
app.post('/upload/multiple', async (req: VerbRequest, res: VerbResponse) => {
  try {
    if (!req.formData) {
      return res.status(400).json({ error: 'No form data found' });
    }

    const formDataResult = await req.formData!() as unknown as { fields: Record<string, string>; files: Record<string, any> };
    const fields = formDataResult.fields;
    const files = formDataResult.files;
    const uploadedFiles = files.files;
    
    if (!uploadedFiles) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    // Handle both single file and multiple files
    const fileArray = Array.isArray(uploadedFiles) ? uploadedFiles : [uploadedFiles];
    const results = [];
    const errors = [];

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i] as UploadedFile;
      
      // Validate each file
      const validation = validateFile(file, {
        maxFileSize: 5 * 1024 * 1024, // 5MB per file
        allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'text/plain']
      });

      if (!validation.valid) {
        errors.push({
          file: file.name,
          errors: validation.errors
        });
        continue;
      }

      try {
        const savedFile = await saveFile(file, {
          uploadDir: './uploads',
          generateFileName: generateUniqueFileName
        });
        results.push(savedFile);
      } catch (error) {
        errors.push({
          file: file.name,
          error: error instanceof Error ? error.message : 'Save failed'
        });
      }
    }

    return res.json({
      message: `Processed ${fileArray.length} files`,
      description: fields.description,
      uploaded: results.length,
      failed: errors.length,
      files: results,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Multiple upload error:', error);
    return res.status(500).json({ 
      error: 'Upload failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Get uploaded files list
app.get('/uploads', async (_req: VerbRequest, res: VerbResponse) => {
  try {
    const uploadsDir = './uploads';
    const files = await Array.fromAsync(
      new Bun.Glob('*').scan({ cwd: uploadsDir })
    );
    
    const fileDetails = await Promise.all(
      files
        .filter(name => name !== '.keep')
        .map(async (name) => {
          const file = Bun.file(`${uploadsDir}/${name}`);
          return {
            name,
            size: file.size,
            lastModified: new Date((await file.stat()).mtime).toISOString()
          };
        })
    );

    return res.json({
      message: 'Files in upload directory',
      count: fileDetails.length,
      files: fileDetails
    });
  } catch (error) {
    return res.status(500).json({ 
      error: 'Failed to list files',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Download uploaded file
app.get('/uploads/:filename', async (req: VerbRequest, res: VerbResponse) => {
  const { filename } = req.params || {};
  const filePath = `./uploads/${filename}`;
  
  try {
    const file = Bun.file(filePath);
    if (!(await file.exists())) {
      return res.status(404).json({ error: 'File not found' });
    }

    // For file downloads, use the sendFile method
    return await res.sendFile(filePath);
  } catch (error) {
    return res.status(500).json({ 
      error: 'Failed to serve file',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

const port = 3000;
app.withOptions({
  port,
  hostname: 'localhost',
  development: {
    hmr: true,
    console: true
  }
});
app.listen();

console.log(`🚀 Verb file upload server running on http://localhost:${port}`);
console.log('Endpoints:');
console.log('  GET  /              - Upload form');
console.log('  POST /upload/single - Single file upload');
console.log('  POST /upload/multiple - Multiple files upload');
console.log('  GET  /uploads       - List uploaded files');
console.log('  GET  /uploads/:file - Download file');