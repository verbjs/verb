import { createServer } from "verb";
import homepage from "./index.html";

const app = createServer();

// Serve homepage on root route
app.get('/', (_req, res) => {
  res.send(homepage);
});

// Start the default HTTP server
const port = 3000;
app.listen(port);
console.log(`🚀 Server running on http://localhost:${port}`);