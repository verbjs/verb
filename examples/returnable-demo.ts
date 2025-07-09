import { createServer } from "../src/index";
import type { Request, Response } from "../src/index";

const app = createServer();

// ✨ Clean early returns - no more nested if/else
app.get("/users/:id", (req: Request, res: Response) => {
  const id = parseInt(req.params?.id || '0');
  if (Number.isNaN(id)) { return res.status(400).json({ error: "Invalid ID" }); }
  if (id < 1) { return res.status(400).json({ error: "ID must be positive" }); }
  
  return res.json({ id, name: `User ${id}` });
});

// ✨ Async file operations
app.get("/download", async (_req: Request, res: Response) => {
  return await res.download("./package.json");
});

// ✨ React server-side rendering
app.get("/react/:name", (req: Request, res: Response) => {
  const Welcome = ({ name }: { name: string }) => 
    `<h1>Hello ${name}!</h1><p>Server-rendered React</p>`;
  
  return res.react(Welcome, { name: req.params?.name });
});

// ✨ Complex conditional logic made simple
app.post("/auth", (req: Request, res: Response) => {
  const { user, pass } = req.body || {};
  if (!user || !pass) { return res.status(400).json({ error: "Missing credentials" }); }
  if (user === "admin" && pass === "secret") { return res.json({ token: "abc123" }); }
  
  return res.status(401).json({ error: "Invalid credentials" });
});

console.log(`
🚀 Returnable Response Demo
   
Try: curl http://localhost:3000/users/123
     curl http://localhost:3000/users/abc  
     curl http://localhost:3000/download
     curl http://localhost:3000/react/World
     curl -X POST http://localhost:3000/auth -d '{"user":"admin","pass":"secret"}' -H "Content-Type: application/json"
`);

app.listen(3000);