---
title: Streaming
description: Learn how to work with streaming responses in Verb applications
---

# Streaming in Verb

Streaming allows you to send data to clients incrementally, which is useful for large responses, real-time updates, and server-sent events. Verb provides built-in support for streaming through the Web Streams API.

## Basic Streaming Response

You can create a streaming response using the `ReadableStream` API:

```typescript
import { createServer } from "@verb/server";

const app = createServer();

app.get("/stream", () => {
  // Create a readable stream
  const stream = new ReadableStream({
    start(controller) {
      let count = 0;
      
      // Send a message every second, 10 times
      const interval = setInterval(() => {
        const message = `Message ${count++}\n`;
        controller.enqueue(new TextEncoder().encode(message));
        
        if (count >= 10) {
          clearInterval(interval);
          controller.close();
        }
      }, 1000);
    }
  });
  
  // Return a streaming response
  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive"
    }
  });
});

app.listen(3000);
```

## Server-Sent Events (SSE)

Server-Sent Events provide a standardized way to send real-time updates from the server to the client:

```typescript
import { createServer } from "@verb/server";

const app = createServer();

app.get("/sse", () => {
  // Create a readable stream for SSE
  const stream = new ReadableStream({
    start(controller) {
      let count = 0;
      
      // Function to format SSE messages
      const sendMessage = (data: any, event?: string) => {
        let message = `data: ${JSON.stringify(data)}\n`;
        if (event) {
          message = `event: ${event}\n${message}`;
        }
        message += "\n";
        controller.enqueue(new TextEncoder().encode(message));
      };
      
      // Send initial message
      sendMessage({ message: "Connection established" }, "open");
      
      // Send a message every second
      const interval = setInterval(() => {
        sendMessage({ 
          count: count++, 
          time: new Date().toISOString() 
        }, "update");
        
        // Simulate different event types
        if (count % 5 === 0) {
          sendMessage({ message: "Milestone reached" }, "milestone");
        }
        
        // End the stream after 60 messages
        if (count >= 60) {
          clearInterval(interval);
          controller.close();
        }
      }, 1000);
    }
  });
  
  // Return an SSE response
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive"
    }
  });
});

app.listen(3000);
```

Client-side code to consume SSE:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Server-Sent Events</title>
</head>
<body>
  <h1>Server-Sent Events</h1>
  <div id="messages"></div>

  <script>
    const messagesDiv = document.getElementById('messages');
    
    // Create an EventSource instance
    const eventSource = new EventSource('/sse');
    
    // Handle connection open
    eventSource.addEventListener('open', function(event) {
      const data = JSON.parse(event.data);
      const messageElement = document.createElement('div');
      messageElement.textContent = `Connection: ${data.message}`;
      messageElement.style.color = 'green';
      messagesDiv.appendChild(messageElement);
    });
    
    // Handle regular updates
    eventSource.addEventListener('update', function(event) {
      const data = JSON.parse(event.data);
      const messageElement = document.createElement('div');
      messageElement.textContent = `Update ${data.count}: ${data.time}`;
      messagesDiv.appendChild(messageElement);
    });
    
    // Handle milestone events
    eventSource.addEventListener('milestone', function(event) {
      const data = JSON.parse(event.data);
      const messageElement = document.createElement('div');
      messageElement.textContent = `Milestone: ${data.message}`;
      messageElement.style.fontWeight = 'bold';
      messageElement.style.color = 'blue';
      messagesDiv.appendChild(messageElement);
    });
    
    // Handle errors
    eventSource.onerror = function(error) {
      const messageElement = document.createElement('div');
      messageElement.textContent = 'Connection error';
      messageElement.style.color = 'red';
      messagesDiv.appendChild(messageElement);
      
      // Close the connection
      eventSource.close();
    };
  </script>
</body>
</html>
```

## Streaming File Downloads

You can stream files to clients, which is useful for large files:

```typescript
import { createServer } from "@verb/server";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { join } from "path";

const app = createServer();

app.get("/download/:filename", async (req) => {
  const filename = req.params.filename;
  const filePath = join(process.cwd(), "files", filename);
  
  try {
    // Check if file exists and get its size
    const stats = await stat(filePath);
    
    if (!stats.isFile()) {
      return new Response("Not found", { status: 404 });
    }
    
    // Create a readable stream from the file
    const fileStream = createReadStream(filePath);
    
    // Convert Node.js stream to Web Stream
    const webStream = new ReadableStream({
      start(controller) {
        fileStream.on("data", (chunk) => {
          controller.enqueue(chunk);
        });
        
        fileStream.on("end", () => {
          controller.close();
        });
        
        fileStream.on("error", (err) => {
          controller.error(err);
        });
      },
      cancel() {
        fileStream.destroy();
      }
    });
    
    // Return a streaming response
    return new Response(webStream, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": stats.size.toString()
      }
    });
  } catch (error) {
    console.error("Error streaming file:", error);
    
    return new Response("Not found", { status: 404 });
  }
});

app.listen(3000);
```

## JSON Streaming

You can stream JSON data, which is useful for large datasets:

```typescript
import { createServer } from "@verb/server";

const app = createServer();

app.get("/stream-json", () => {
  // Create a readable stream for JSON data
  const stream = new ReadableStream({
    start(controller) {
      // Start the JSON array
      controller.enqueue(new TextEncoder().encode('[\n'));
      
      let count = 0;
      let isFirst = true;
      
      // Generate and send 1000 items
      const interval = setInterval(() => {
        // Generate a batch of items
        const batch = [];
        for (let i = 0; i < 10 && count < 1000; i++, count++) {
          batch.push({
            id: count,
            name: `Item ${count}`,
            value: Math.random() * 1000,
            timestamp: new Date().toISOString()
          });
        }
        
        // Format the batch as JSON
        let json = '';
        for (const item of batch) {
          if (!isFirst) {
            json += ',\n';
          } else {
            isFirst = false;
          }
          json += JSON.stringify(item);
        }
        
        // Send the batch
        controller.enqueue(new TextEncoder().encode(json));
        
        // End the stream after 1000 items
        if (count >= 1000) {
          clearInterval(interval);
          // End the JSON array
          controller.enqueue(new TextEncoder().encode('\n]'));
          controller.close();
        }
      }, 100);
    }
  });
  
  // Return a streaming JSON response
  return new Response(stream, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive"
    }
  });
});

app.listen(3000);
```

## Streaming with Transformers

You can use `TransformStream` to process data as it flows through the stream:

```typescript
import { createServer } from "@verb/server";
import { createReadStream } from "fs";
import { join } from "path";

const app = createServer();

app.get("/transform-csv", () => {
  const filePath = join(process.cwd(), "data", "large-dataset.csv");
  const fileStream = createReadStream(filePath);
  
  // Convert Node.js stream to Web Stream
  const readableStream = new ReadableStream({
    start(controller) {
      fileStream.on("data", (chunk) => {
        controller.enqueue(chunk);
      });
      
      fileStream.on("end", () => {
        controller.close();
      });
      
      fileStream.on("error", (err) => {
        controller.error(err);
      });
    },
    cancel() {
      fileStream.destroy();
    }
  });
  
  // Create a transform stream to convert CSV to JSON
  let buffer = "";
  let headers: string[] = [];
  let isFirstChunk = true;
  
  const csvToJsonTransformer = new TransformStream({
    transform(chunk, controller) {
      // Convert chunk to string and append to buffer
      buffer += new TextDecoder().decode(chunk);
      
      // Process complete lines
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // Keep the last incomplete line in the buffer
      
      if (isFirstChunk && lines.length > 0) {
        // Parse headers from the first line
        headers = lines[0].split(",").map(header => header.trim());
        isFirstChunk = false;
        
        // Start JSON array
        controller.enqueue(new TextEncoder().encode('[\n'));
        
        // Skip the header line
        lines.shift();
      }
      
      // Process each complete line
      let isFirstLine = true;
      for (const line of lines) {
        if (line.trim() === "") continue;
        
        // Split the line into values
        const values = line.split(",").map(value => value.trim());
        
        // Create an object from headers and values
        const obj: Record<string, string> = {};
        for (let i = 0; i < headers.length; i++) {
          obj[headers[i]] = values[i] || "";
        }
        
        // Add comma separator between objects
        if (!isFirstLine) {
          controller.enqueue(new TextEncoder().encode(',\n'));
        } else {
          isFirstLine = false;
        }
        
        // Convert object to JSON and send
        controller.enqueue(new TextEncoder().encode(JSON.stringify(obj)));
      }
    },
    flush(controller) {
      // Process any remaining data in the buffer
      if (buffer.trim() !== "") {
        const values = buffer.split(",").map(value => value.trim());
        
        const obj: Record<string, string> = {};
        for (let i = 0; i < headers.length; i++) {
          obj[headers[i]] = values[i] || "";
        }
        
        controller.enqueue(new TextEncoder().encode(',\n'));
        controller.enqueue(new TextEncoder().encode(JSON.stringify(obj)));
      }
      
      // End JSON array
      controller.enqueue(new TextEncoder().encode('\n]'));
    }
  });
  
  // Pipe the streams
  const transformedStream = readableStream.pipeThrough(csvToJsonTransformer);
  
  // Return a streaming response
  return new Response(transformedStream, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache"
    }
  });
});

app.listen(3000);
```

## Streaming with Compression

You can combine streaming with compression for efficient data transfer:

```typescript
import { createServer } from "@verb/server";
import { createReadStream } from "fs";
import { join } from "path";
import { createGzip } from "zlib";

const app = createServer();

app.get("/download-compressed/:filename", async (req) => {
  const filename = req.params.filename;
  const filePath = join(process.cwd(), "files", filename);
  
  try {
    // Create a readable stream from the file
    const fileStream = createReadStream(filePath);
    
    // Create a gzip transform stream
    const gzipStream = createGzip();
    
    // Pipe the file stream through the gzip stream
    fileStream.pipe(gzipStream);
    
    // Convert Node.js stream to Web Stream
    const webStream = new ReadableStream({
      start(controller) {
        gzipStream.on("data", (chunk) => {
          controller.enqueue(chunk);
        });
        
        gzipStream.on("end", () => {
          controller.close();
        });
        
        gzipStream.on("error", (err) => {
          controller.error(err);
        });
      },
      cancel() {
        fileStream.destroy();
        gzipStream.end();
      }
    });
    
    // Return a compressed streaming response
    return new Response(webStream, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${filename}.gz"`,
        "Content-Encoding": "gzip"
      }
    });
  } catch (error) {
    console.error("Error streaming file:", error);
    
    return new Response("Not found", { status: 404 });
  }
});

app.listen(3000);
```

## Best Practices

- **Set Appropriate Headers**: Use the correct Content-Type and Cache-Control headers
- **Handle Errors**: Properly handle errors in your streams
- **Clean Up Resources**: Make sure to clean up resources when streams are cancelled
- **Use Compression**: Consider using compression for large responses
- **Implement Backpressure**: Handle backpressure to prevent memory issues
- **Monitor Connections**: Monitor and limit the number of concurrent streaming connections
- **Test with Slow Connections**: Test your streaming endpoints with slow and unreliable connections
- **Provide Fallbacks**: Provide non-streaming fallbacks for clients that don't support streaming

## Next Steps

- [WebSockets](/server/websockets) - Learn about WebSockets in Verb
- [File Upload](/server/file-upload) - Learn about file uploads in Verb
- [Middleware](/server/middleware) - Explore middleware in Verb