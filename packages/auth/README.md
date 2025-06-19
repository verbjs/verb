# @verb/auth

Comprehensive authentication plugin for the Verb library, supporting OAuth2, username/password authentication, and multiple storage backends.

## Features

- OAuth2 provider support (Google, GitHub, Discord, etc.)
- Username/email and password authentication
- Multiple storage adapters:
  - SQLite
  - PostgreSQL
  - YAML files
- Session management
- JWT token support
- Secure password hashing with bcrypt
- Type-safe authentication middleware

## Installation

```bash
bun add @verb/auth

# For SQLite support (optional)
bun add better-sqlite3

# For PostgreSQL support (optional)
bun add postgres
```

## Quick Start

```typescript
import { createServer } from "verb";
import { createAuthPlugin } from "@verb/auth";

const app = createServer({ port: 3000 });

// Register auth plugin with SQLite storage
app.register(createAuthPlugin({
  storage: {
    type: "sqlite",
    database: "./auth.db"
  },
  session: {
    secret: "your-session-secret",
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Protected route
app.get("/dashboard", app.auth.requireAuth, (req) => {
  return json({ user: req.user });
});

// OAuth2 routes
app.get("/auth/google", app.auth.oauth2("google"));
app.get("/auth/google/callback", app.auth.oauth2Callback("google"));

// Local auth routes
app.post("/auth/login", app.auth.login);
app.post("/auth/register", app.auth.register);
app.post("/auth/logout", app.auth.logout);
```

## Configuration

### OAuth2 Providers

```typescript
const authConfig = {
  providers: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      redirectUri: "http://localhost:3000/auth/google/callback"
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      redirectUri: "http://localhost:3000/auth/github/callback"
    }
  }
};
```

### Storage Adapters

#### SQLite
```typescript
{
  storage: {
    type: "sqlite",
    database: "./auth.db"
  }
}
```

#### PostgreSQL
```typescript
{
  storage: {
    type: "postgresql",
    connectionString: "postgresql://user:password@localhost:5432/mydb"
  }
}
```

#### YAML
```typescript
{
  storage: {
    type: "yaml",
    filePath: "./users.yaml"
  }
}
```

## API Reference

### Authentication Methods

- `app.auth.requireAuth` - Middleware to require authentication
- `app.auth.optionalAuth` - Middleware for optional authentication
- `app.auth.login` - Local login handler
- `app.auth.register` - User registration handler
- `app.auth.logout` - Logout handler
- `app.auth.oauth2(provider)` - OAuth2 login redirect
- `app.auth.oauth2Callback(provider)` - OAuth2 callback handler

### User Object

```typescript
interface User {
  id: string;
  email: string;
  username?: string;
  name?: string;
  avatar?: string;
  provider: "local" | "google" | "github" | string;
  createdAt: Date;
  updatedAt: Date;
}
```

## License

MIT