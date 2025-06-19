# Verb Authentication Demo

This template demonstrates how to build a Verb application with comprehensive authentication features using `@verb/auth`.

## Features

- **Public Routes**: Accessible without authentication
- **Protected Routes**: Require user authentication
- **Local Authentication**: Username/password registration and login
- **OAuth2 Integration**: Support for Google and GitHub login
- **Session Management**: Secure session handling with SQLite storage
- **Interactive Demo**: Complete HTML interface for testing auth flows

## Quick Start

1. **Install dependencies:**
   ```bash
   bun install
   ```

2. **Set up environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your OAuth2 credentials (optional)
   ```

3. **Start the development server:**
   ```bash
   bun run dev
   ```

4. **Visit http://localhost:3000** and try:
   - Public route: `/` (no auth required)
   - Protected route: `/hello` (requires login)
   - User info: `/auth/me` (requires login)

## Routes

### Public Routes
- `GET /` - Welcome page with auth demo interface
- `GET /health` - Health check endpoint

### Authentication Routes
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `POST /auth/logout` - User logout
- `GET /auth/me` - Get current user info (protected)

### OAuth2 Routes (if configured)
- `GET /auth/google` - Google OAuth2 login
- `GET /auth/google/callback` - Google OAuth2 callback
- `GET /auth/github` - GitHub OAuth2 login
- `GET /auth/github/callback` - GitHub OAuth2 callback

### Protected Routes
- `GET /hello` - Protected hello world page

## OAuth2 Setup

### Google OAuth2
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google+ API
4. Create OAuth2 credentials
5. Add `http://localhost:3000/auth/google/callback` to authorized redirect URIs
6. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`

### GitHub OAuth2
1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Create a new OAuth App
3. Set Authorization callback URL to `http://localhost:3000/auth/github/callback`
4. Set `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` in `.env`

## Configuration

The auth plugin is configured in `src/index.ts`:

```typescript
const authPlugin = createAuthPlugin({
  storage: {
    type: "sqlite",
    database: "./auth.db"
  },
  session: {
    secret: process.env.SESSION_SECRET || "fallback-secret",
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax"
  },
  providers: {
    google: { /* OAuth2 config */ },
    github: { /* OAuth2 config */ }
  },
  registration: {
    enabled: true,
    requireEmailVerification: false
  }
});
```

## Testing the Demo

1. **Register a new user** using the registration form
2. **Login** with your credentials
3. **Access protected routes** like `/hello`
4. **Try OAuth2** if you've configured Google/GitHub
5. **View user data** at `/auth/me`
6. **Logout** to test session cleanup

## Database

This template uses SQLite for simplicity. The database file `auth.db` will be created automatically and contains:
- Users table (id, email, username, password hash, etc.)
- Sessions table (id, user_id, token, expiration, etc.)

## Security Features

- **Password Hashing**: bcrypt with salt rounds
- **Session Management**: Secure HTTP-only cookies
- **CSRF Protection**: OAuth2 state parameter validation
- **Session Expiration**: Automatic cleanup of expired sessions
- **Input Validation**: Email format and password strength

## Production Considerations

1. **Set a strong SESSION_SECRET** in production
2. **Use HTTPS** (set `secure: true` in session config)
3. **Configure proper OAuth2 redirect URIs** for your domain
4. **Consider using PostgreSQL** for production database
5. **Enable email verification** for registration
6. **Set up proper error logging**

## Extending the Template

### Add Role-Based Access Control
```typescript
// Add roles to user metadata during registration
app.get("/admin", authPlugin.middleware.requireRole(["admin"]), handler);
```

### Add Email Verification
```typescript
const authPlugin = createAuthPlugin({
  // ...
  registration: {
    enabled: true,
    requireEmailVerification: true
  }
});
```

### Use PostgreSQL Storage
```typescript
const authPlugin = createAuthPlugin({
  storage: {
    type: "postgresql",
    connectionString: process.env.DATABASE_URL
  },
  // ...
});
```

### Add Rate Limiting
```typescript
app.post("/auth/login", 
  authPlugin.middleware.rateLimit(5, 15 * 60 * 1000), // 5 attempts per 15 minutes
  authPlugin.handlers.login
);
```

## Troubleshooting

### Common Issues

1. **"Storage initialization failed"**
   - Make sure `better-sqlite3` is installed: `bun add better-sqlite3`

2. **OAuth2 not working**
   - Check your client ID and secret are correct
   - Verify redirect URIs match exactly
   - Ensure the OAuth app is enabled

3. **Session not persisting**
   - Check that cookies are enabled in your browser
   - Verify `SESSION_SECRET` is set

4. **Authentication middleware not working**
   - Ensure middleware is applied before route handlers
   - Check that session cookies are being sent

### Debug Mode

Set environment variable for verbose logging:
```bash
DEBUG=verb:auth bun run dev
```

## Learn More

- [Verb Documentation](https://github.com/wess/verb)
- [@verb/auth Documentation](./packages/auth/README.md)
- [OAuth2 Specification](https://oauth.net/2/)
- [Web Authentication Best Practices](https://web.dev/authentication/)