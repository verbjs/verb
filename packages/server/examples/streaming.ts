import { 
  createServer, 
  stream, 
  streamFile, 
  streamSSE, 
  streamJSON, 
  streamText,
  json 
} from "../src/index.ts";

const app = createServer({ port: 3000 });

// Example 1: Basic ReadableStream
app.get("/stream/basic", () => {
  const dataStream = new ReadableStream({
    start(controller) {
      controller.enqueue("Hello ");
      controller.enqueue("from ");
      controller.enqueue("streaming!");
      controller.close();
    }
  });
  
  return stream(dataStream, "text/plain");
});

// Example 2: Stream a large file
app.get("/stream/file/:filename", async (req, params) => {
  const filename = params.filename;
  return await streamFile(`./examples/assets/${filename}`);
});

// Example 3: Server-Sent Events (SSE)
app.get("/stream/events", () => {
  async function* eventGenerator() {
    let count = 0;
    while (count < 10) {
      yield { 
        data: JSON.stringify({ message: `Event ${count}`, timestamp: Date.now() }),
        id: count.toString(),
        event: "message"
      };
      await new Promise(resolve => setTimeout(resolve, 1000));
      count++;
    }
    
    // Send completion event
    yield {
      data: JSON.stringify({ message: "Stream complete" }),
      event: "complete"
    };
  }
  
  return streamSSE(eventGenerator());
});

// Example 4: Stream JSON data (JSONL format)
app.get("/stream/data", () => {
  async function* dataGenerator() {
    for (let i = 0; i < 1000; i++) {
      yield {
        id: i,
        name: `User ${i}`,
        timestamp: Date.now(),
        data: `Some data for user ${i}`
      };
      
      // Simulate processing delay
      if (i % 100 === 0) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
  }
  
  return streamJSON(dataGenerator());
});

// Example 5: Chunked text streaming with delay
app.get("/stream/text", () => {
  const chunks = [
    "This is a demonstration ",
    "of chunked text streaming. ",
    "Each chunk arrives with a delay, ",
    "simulating real-time data processing. ",
    "Perfect for chat applications, ",
    "live logs, or progressive content loading!"
  ];
  
  return streamText(chunks, "text/plain", 500); // 500ms delay between chunks
});

// Example 6: Async generator text streaming
app.get("/stream/async-text", () => {
  async function* textGenerator() {
    const sentences = [
      "Async generators provide powerful streaming capabilities.",
      "They can fetch data on-demand from databases or APIs.",
      "Memory usage stays constant regardless of data size.",
      "Perfect for processing large datasets efficiently."
    ];
    
    for (const sentence of sentences) {
      yield sentence + " ";
      await new Promise(resolve => setTimeout(resolve, 800));
    }
  }
  
  return streamText(textGenerator());
});

// Example 7: Live data streaming (simulated sensor data)
app.get("/stream/sensors", () => {
  async function* sensorData() {
    let reading = 0;
    while (reading < 50) {
      const temperature = 20 + Math.random() * 10;
      const humidity = 40 + Math.random() * 20;
      const pressure = 1013 + Math.random() * 10;
      
      yield {
        data: JSON.stringify({
          reading: reading++,
          temperature: Math.round(temperature * 100) / 100,
          humidity: Math.round(humidity * 100) / 100,
          pressure: Math.round(pressure * 100) / 100,
          timestamp: new Date().toISOString()
        }),
        id: reading.toString(),
        event: "sensor-reading"
      };
      
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  return streamSSE(sensorData());
});

// Example 8: Chat-like streaming
app.get("/stream/chat", () => {
  const messages = [
    "Hello! Welcome to the chat stream.",
    "This simulates a real-time chat application.",
    "Messages appear one by one with realistic delays.",
    "You could connect this to a real chat system.",
    "Or use it for AI chat responses.",
    "The possibilities are endless!",
    "Thanks for trying Verb's streaming features! 🚀"
  ];
  
  async function* chatGenerator() {
    for (let i = 0; i < messages.length; i++) {
      yield {
        data: JSON.stringify({
          id: i,
          message: messages[i],
          user: i % 2 === 0 ? "System" : "Assistant",
          timestamp: new Date().toISOString()
        }),
        event: "message"
      };
      
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }
  
  return streamSSE(chatGenerator());
});

// Example 9: Large dataset streaming with backpressure handling
app.get("/stream/dataset", () => {
  async function* datasetGenerator() {
    const batchSize = 100;
    const totalRecords = 10000;
    
    for (let batch = 0; batch < totalRecords / batchSize; batch++) {
      const records = [];
      
      for (let i = 0; i < batchSize; i++) {
        const recordId = batch * batchSize + i;
        records.push({
          id: recordId,
          name: `Record ${recordId}`,
          value: Math.random() * 1000,
          category: `Category ${recordId % 10}`,
          created: new Date().toISOString()
        });
      }
      
      // Yield entire batch as a single JSON object
      yield {
        batch: batch,
        records: records,
        total: totalRecords,
        progress: Math.round((batch + 1) / (totalRecords / batchSize) * 100)
      };
      
      // Small delay to prevent overwhelming the client
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
  
  return streamJSON(datasetGenerator());
});

// Example 10: HTML page to test all streaming endpoints
app.get("/", () => {
  return new Response(`
<!DOCTYPE html>
<html>
<head>
    <title>Verb Streaming Examples</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .endpoint { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .endpoint h3 { margin-top: 0; color: #333; }
        .endpoint a { color: #007bff; text-decoration: none; }
        .endpoint a:hover { text-decoration: underline; }
        pre { background: #f8f9fa; padding: 10px; border-radius: 3px; overflow-x: auto; }
        .description { margin: 10px 0; color: #666; }
    </style>
</head>
<body>
    <h1>🚀 Verb Streaming Examples</h1>
    <p>Click the links below to test different streaming capabilities:</p>
    
    <div class="endpoint">
        <h3><a href="/stream/basic">/stream/basic</a></h3>
        <div class="description">Basic ReadableStream example with simple text chunks</div>
    </div>
    
    <div class="endpoint">
        <h3><a href="/stream/events">/stream/events</a></h3>
        <div class="description">Server-Sent Events (SSE) - perfect for real-time updates</div>
        <pre>// JavaScript client code:
const events = new EventSource('/stream/events');
events.onmessage = (e) => console.log(JSON.parse(e.data));</pre>
    </div>
    
    <div class="endpoint">
        <h3><a href="/stream/data">/stream/data</a></h3>
        <div class="description">JSON Lines (JSONL) streaming - 1000 records streamed efficiently</div>
    </div>
    
    <div class="endpoint">
        <h3><a href="/stream/text">/stream/text</a></h3>
        <div class="description">Chunked text streaming with 500ms delays between chunks</div>
    </div>
    
    <div class="endpoint">
        <h3><a href="/stream/async-text">/stream/async-text</a></h3>
        <div class="description">Async generator text streaming with realistic delays</div>
    </div>
    
    <div class="endpoint">
        <h3><a href="/stream/sensors">/stream/sensors</a></h3>
        <div class="description">Simulated sensor data streaming via SSE</div>
    </div>
    
    <div class="endpoint">
        <h3><a href="/stream/chat">/stream/chat</a></h3>
        <div class="description">Chat-like message streaming simulation</div>
    </div>
    
    <div class="endpoint">
        <h3><a href="/stream/dataset">/stream/dataset</a></h3>
        <div class="description">Large dataset streaming (10,000 records in batches)</div>
    </div>
    
    <h2>💡 Tips</h2>
    <ul>
        <li>Use browser developer tools to see streaming in action</li>
        <li>SSE endpoints work great with <code>EventSource</code> in JavaScript</li>
        <li>JSONL endpoints can be processed line-by-line as they arrive</li>
        <li>All streams are memory-efficient and handle backpressure automatically</li>
    </ul>
</body>
</html>
  `, {
    headers: { "Content-Type": "text/html" }
  });
});

console.log("🚀 Verb streaming examples server running at http://localhost:3000");
console.log("📖 Visit http://localhost:3000 to see all available streaming endpoints");
