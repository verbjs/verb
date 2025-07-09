import { createServer } from "../src/index";
import type { Request, Response } from "../src/index";
const app = createServer();

// Before: Nested conditions
app.get("/old-way/:id", (req: Request, res: Response) => {
  const id = parseInt(req.params?.id || '0');
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
  } else if (id < 1) {
    res.status(400).json({ error: "ID must be positive" });
  } else {
    res.json({ id, name: `User ${id}` });
  }
});

// ✨ After: Clean early returns
app.get("/new-way/:id", (req: Request, res: Response) => {
  const id = parseInt(req.params?.id || '0');
  if (Number.isNaN(id)) { return res.status(400).json({ error: "Invalid ID" }); }
  if (id < 1) { return res.status(400).json({ error: "ID must be positive" }); }
  return res.json({ id, name: `User ${id}` });
});

// ✨ All response types are returnable
app.get("/types/:type", (req: Request, res: Response) => {
  switch (req.params?.type) {
    case "json": return res.json({ message: "JSON" });
    case "html": return res.html("<h1>HTML</h1>");
    case "text": return res.text("Plain text");
    case "redirect": return res.redirect("/");
    case "empty": return res.status(204).end();
    default: return res.status(400).json({ error: "Invalid type" });
  }
});

// ✨ Async file operations
app.get("/file/:action", async (req: Request, res: Response) => {
  if (req.params?.action === "download") { return await res.download("./package.json"); }
  if (req.params?.action === "serve") { return await res.sendFile("./README.md"); }
  return res.status(400).json({ error: "Invalid action" });
});

// ✨ React server-side rendering
app.get("/react/:name", (req: Request, res: Response) => {
  const Welcome = ({ name }: { name: string }) => `<h1>Hello ${name}!</h1>`;
  return res.react(Welcome, { name: req.params?.name });
});

// ✨ Authentication with early returns
app.post("/auth", (req: Request, res: Response) => {
  const { user, pass } = req.body || {};
  if (!user || !pass) { return res.status(400).json({ error: "Missing credentials" }); }
  if (user === "admin" && pass === "secret") { return res.json({ token: "abc123" }); }
  return res.status(401).json({ error: "Invalid credentials" });
});

console.log(`
🚀 Returnable Response Patterns

Compare:
  /old-way/123  (nested conditions)
  /new-way/123  (early returns)

Test all types:
  /types/json
  /types/html
  /types/redirect

Files:
  /file/download
  /file/serve

React SSR:
  /react/World

Auth:
  POST /auth {"user":"admin","pass":"secret"}
`);

app.listen(3000);