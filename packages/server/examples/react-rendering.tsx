import { createServer, reactComponent, React, createReactRendererPlugin } from "../src/index.ts";

// Define a simple React component
const Welcome = ({ name, count = 0 }: { name: string; count?: number }) => {
  return (
    <div className="welcome">
      <h1>Welcome, {name}!</h1>
      <p>This page was rendered on the server.</p>
      <p>Visit count: {count}</p>
      <button id="increment">Increment</button>
    </div>
  );
};

// Define a layout component
const Layout = ({ children, title }: { children: React.ReactNode; title: string }) => {
  return (
    <html>
      <head>
        <title>{title}</title>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body>
        <header>
          <nav>
            <a href="/">Home</a>
            <a href="/about">About</a>
            <a href="/contact">Contact</a>
          </nav>
        </header>
        <main>
          {children}
        </main>
        <footer>
          <p>&copy; {new Date().getFullYear()} Verb Framework</p>
        </footer>
      </body>
    </html>
  );
};

// Create a server with React renderer
async function startServer() {
  const app = createServer({ port: 3000 });
  
  // Register React renderer plugin
  await app.register(createReactRendererPlugin({
    cache: true,
    maxCacheSize: 50,
  }));
  
  // Simple counter for demo
  let visitCount = 0;
  
  // Define routes
  app.get("/", (req) => {
    visitCount++;
    
    // Render React component with hydration
    return reactComponent(
      <Welcome name="World" count={visitCount} />,
      {
        title: "Welcome to Verb + React",
        styles: ["/styles.css"],
        scripts: ["/client.js"],
        hydrate: true,
        props: { name: "World", count: visitCount },
      }
    );
  });
  
  app.get("/about", (req) => {
    // Render with custom layout
    const content = <p>This is a demo of server-side rendering with React and Verb.</p>;
    
    return reactComponent(
      <Layout title="About - Verb + React">
        <h1>About</h1>
        {content}
      </Layout>,
      {
        // No template needed since Layout provides the full HTML structure
        template: (content) => content,
      }
    );
  });
  
  app.get("/stream", (req) => {
    // Example of streaming rendering for large components
    return reactComponent(
      <div>
        <h1>Streaming Demo</h1>
        <ul>
          {Array.from({ length: 1000 }, (_, i) => (
            <li key={i}>Item {i + 1}</li>
          ))}
        </ul>
      </div>,
      {
        stream: true,
        title: "Streaming Demo",
      }
    );
  });
  
  // Serve static files for client-side hydration
  app.get("/client.js", (req) => {
    // In a real app, this would be a bundled JS file
    const clientJs = `
      // Hydration example
      const button = document.getElementById('increment');
      let count = window.__INITIAL_PROPS__.count;
      
      button.addEventListener('click', () => {
        count++;
        document.querySelector('.welcome p:nth-child(3)').textContent = 'Visit count: ' + count;
      });
    `;
    
    return new Response(clientJs, {
      headers: { "Content-Type": "application/javascript" }
    });
  });
  
  app.get("/styles.css", (req) => {
    const css = `
      body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; }
      .welcome { background: #f5f5f5; padding: 2rem; border-radius: 8px; }
      h1 { color: #0070f3; }
      button { background: #0070f3; color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; }
      nav { display: flex; gap: 1rem; margin-bottom: 2rem; }
      nav a { color: #0070f3; text-decoration: none; }
      footer { margin-top: 2rem; border-top: 1px solid #eaeaea; padding-top: 1rem; }
    `;
    
    return new Response(css, {
      headers: { "Content-Type": "text/css" }
    });
  });
  
  console.log("React SSR server running at http://localhost:3000");
}

// Start the server
if (import.meta.main) {
  startServer().catch(console.error);
}

export { startServer, Welcome, Layout };