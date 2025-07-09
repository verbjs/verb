import { createServer } from "../src/index";
import type { Request, Response } from "../src/index"; // Clean types without "Verb" prefix

const app = createServer();

// ✨ Clean type annotations - no "Verb" prefix needed
app.get("/users/:id", (req: Request, res: Response) => {
  const { id } = req.params || {};
  if (!id) {
    return res.status(400).json({ error: "Missing user ID" });
  }
  
  return res.json({ 
    id, 
    name: `User ${id}`,
    cookies: req.cookies,
    ip: req.ip,
    secure: req.secure
  });
});

// ✨ Type inference works perfectly
app.post("/auth", (req: Request, res: Response) => { // No need to explicitly type - inference works
  const { username, password } = req.body || {};
  
  if (!username || !password) {
    return res.status(400).json({ error: "Missing credentials" });
  }
  
  return res.json({ token: "abc123", user: username });
});

// ✨ Function with explicit types
const handleUserUpdate = (req: Request, res: Response) => {
  const { id } = req.params || {};
  return res.json({ message: `Updated user ${id}` });
};

app.put("/users/:id", handleUserUpdate);

// ✨ Async handlers work seamlessly
app.get("/download", async (req: Request, res: Response) => {
  return await res.download("./package.json");
});

console.log(`
✨ Clean Types Demo

Now you can use:
  import type { Request, Response } from "verb"
  
Instead of:
  import type { VerbRequest, VerbResponse } from "verb"

Much cleaner! 🎉
`);

app.listen(3000);