---
title: File Upload
description: Learn how to handle file uploads in Verb applications
---

# File Upload in Verb

Handling file uploads is a common requirement for web applications. Verb provides built-in support for file uploads through the standard Web API `FormData` interface, making it easy to process uploaded files.

## Basic File Upload

Verb makes it simple to handle file uploads using the `formData()` method on the request object:

```typescript
import { createServer } from "@verb/server";
import { writeFile } from "fs/promises";
import { join } from "path";

const app = createServer();

app.post("/upload", async (req) => {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    
    if (!file) {
      return new Response(JSON.stringify({ error: "No file uploaded" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    // Get file details
    const filename = file.name;
    const mimetype = file.type;
    const size = file.size;
    
    // Read file content as ArrayBuffer
    const buffer = await file.arrayBuffer();
    
    // Save the file
    const uploadDir = join(process.cwd(), "uploads");
    await writeFile(join(uploadDir, filename), Buffer.from(buffer));
    
    return new Response(JSON.stringify({
      message: "File uploaded successfully",
      filename,
      mimetype,
      size
    }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    
    return new Response(JSON.stringify({ error: "Failed to upload file" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});

app.listen(3000);
```

## HTML Form for File Upload

Here's a simple HTML form for uploading files:

```html
<!DOCTYPE html>
<html>
<head>
  <title>File Upload</title>
</head>
<body>
  <h1>File Upload</h1>
  <form action="/upload" method="post" enctype="multipart/form-data">
    <input type="file" name="file" required>
    <button type="submit">Upload</button>
  </form>
</body>
</html>
```

You can serve this HTML form from your Verb application:

```typescript
app.get("/", () => {
  return new Response(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>File Upload</title>
    </head>
    <body>
      <h1>File Upload</h1>
      <form action="/upload" method="post" enctype="multipart/form-data">
        <input type="file" name="file" required>
        <button type="submit">Upload</button>
      </form>
    </body>
    </html>
  `, {
    headers: { "Content-Type": "text/html" }
  });
});
```

## Multiple File Upload

You can also handle multiple file uploads:

```typescript
app.post("/upload-multiple", async (req) => {
  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];
    
    if (!files || files.length === 0) {
      return new Response(JSON.stringify({ error: "No files uploaded" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    const uploadDir = join(process.cwd(), "uploads");
    const uploadedFiles = [];
    
    for (const file of files) {
      const filename = file.name;
      const mimetype = file.type;
      const size = file.size;
      
      // Read file content as ArrayBuffer
      const buffer = await file.arrayBuffer();
      
      // Save the file
      await writeFile(join(uploadDir, filename), Buffer.from(buffer));
      
      uploadedFiles.push({ filename, mimetype, size });
    }
    
    return new Response(JSON.stringify({
      message: "Files uploaded successfully",
      files: uploadedFiles
    }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Error uploading files:", error);
    
    return new Response(JSON.stringify({ error: "Failed to upload files" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});
```

HTML form for multiple file uploads:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Multiple File Upload</title>
</head>
<body>
  <h1>Multiple File Upload</h1>
  <form action="/upload-multiple" method="post" enctype="multipart/form-data">
    <input type="file" name="files" multiple required>
    <button type="submit">Upload</button>
  </form>
</body>
</html>
```

## File Upload with Additional Form Data

You can also handle file uploads with additional form data:

```typescript
app.post("/upload-with-data", async (req) => {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const description = formData.get("description") as string;
    const category = formData.get("category") as string;
    
    if (!file) {
      return new Response(JSON.stringify({ error: "No file uploaded" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    // Get file details
    const filename = file.name;
    const mimetype = file.type;
    const size = file.size;
    
    // Read file content as ArrayBuffer
    const buffer = await file.arrayBuffer();
    
    // Save the file
    const uploadDir = join(process.cwd(), "uploads");
    await writeFile(join(uploadDir, filename), Buffer.from(buffer));
    
    // Save metadata (in a real app, you would save to a database)
    const metadata = {
      filename,
      mimetype,
      size,
      description,
      category,
      uploadedAt: new Date().toISOString()
    };
    
    return new Response(JSON.stringify({
      message: "File uploaded successfully",
      metadata
    }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    
    return new Response(JSON.stringify({ error: "Failed to upload file" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});
```

HTML form with additional fields:

```html
<!DOCTYPE html>
<html>
<head>
  <title>File Upload with Metadata</title>
</head>
<body>
  <h1>File Upload with Metadata</h1>
  <form action="/upload-with-data" method="post" enctype="multipart/form-data">
    <div>
      <label for="file">File:</label>
      <input type="file" id="file" name="file" required>
    </div>
    <div>
      <label for="description">Description:</label>
      <textarea id="description" name="description" rows="3"></textarea>
    </div>
    <div>
      <label for="category">Category:</label>
      <select id="category" name="category">
        <option value="document">Document</option>
        <option value="image">Image</option>
        <option value="video">Video</option>
        <option value="other">Other</option>
      </select>
    </div>
    <button type="submit">Upload</button>
  </form>
</body>
</html>
```

## File Upload Validation

It's important to validate uploaded files to ensure they meet your requirements:

```typescript
app.post("/upload-with-validation", async (req) => {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    
    if (!file) {
      return new Response(JSON.stringify({ error: "No file uploaded" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      return new Response(JSON.stringify({ 
        error: "Invalid file type. Only JPEG, PNG, and GIF images are allowed." 
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB in bytes
    if (file.size > maxSize) {
      return new Response(JSON.stringify({ 
        error: "File too large. Maximum size is 5MB." 
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    // Process the file...
    const filename = file.name;
    const buffer = await file.arrayBuffer();
    const uploadDir = join(process.cwd(), "uploads");
    await writeFile(join(uploadDir, filename), Buffer.from(buffer));
    
    return new Response(JSON.stringify({
      message: "File uploaded successfully",
      filename,
      type: file.type,
      size: file.size
    }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    
    return new Response(JSON.stringify({ error: "Failed to upload file" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});
```

## File Upload with Progress Tracking

For client-side progress tracking, you can use the `fetch` API with `XMLHttpRequest`:

```html
<!DOCTYPE html>
<html>
<head>
  <title>File Upload with Progress</title>
  <style>
    .progress {
      width: 100%;
      background-color: #f0f0f0;
      border-radius: 4px;
      margin: 10px 0;
    }
    .progress-bar {
      height: 20px;
      background-color: #4CAF50;
      border-radius: 4px;
      width: 0%;
      transition: width 0.3s;
    }
  </style>
</head>
<body>
  <h1>File Upload with Progress</h1>
  <form id="uploadForm">
    <input type="file" id="file" name="file" required>
    <div class="progress">
      <div class="progress-bar" id="progressBar"></div>
    </div>
    <div id="progressText">0%</div>
    <button type="submit">Upload</button>
  </form>

  <script>
    document.getElementById('uploadForm').addEventListener('submit', function(e) {
      e.preventDefault();
      
      const fileInput = document.getElementById('file');
      const file = fileInput.files[0];
      
      if (!file) {
        alert('Please select a file');
        return;
      }
      
      const formData = new FormData();
      formData.append('file', file);
      
      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', function(e) {
        if (e.lengthComputable) {
          const percentComplete = Math.round((e.loaded / e.total) * 100);
          document.getElementById('progressBar').style.width = percentComplete + '%';
          document.getElementById('progressText').textContent = percentComplete + '%';
        }
      });
      
      xhr.addEventListener('load', function() {
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText);
          alert('File uploaded successfully: ' + response.filename);
        } else {
          alert('Upload failed: ' + xhr.statusText);
        }
      });
      
      xhr.addEventListener('error', function() {
        alert('Upload failed: Network error');
      });
      
      xhr.open('POST', '/upload', true);
      xhr.send(formData);
    });
  </script>
</body>
</html>
```

## Best Practices

- **Validate File Types**: Only accept file types that your application can handle
- **Limit File Size**: Set a maximum file size to prevent server overload
- **Use Secure File Names**: Generate secure file names to prevent path traversal attacks
- **Store Files Outside Web Root**: Store uploaded files in a location not directly accessible via the web
- **Scan for Malware**: Implement virus scanning for uploaded files
- **Use Cloud Storage**: Consider using cloud storage services for production applications
- **Implement Rate Limiting**: Limit the number of files a user can upload in a given time period
- **Add Authentication**: Require authentication for file uploads
- **Use HTTPS**: Always use HTTPS for file uploads to prevent data interception

## Next Steps

- [Streaming](/server/streaming) - Learn about streaming responses in Verb
- [Security](/server/security) - Learn about security best practices in Verb
- [Middleware](/server/middleware) - Explore middleware in Verb