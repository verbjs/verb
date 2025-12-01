# Chapter 8: Deployment

Time to deploy your blog to production.

## Preparing for Production

### Environment Variables

Create `.env.production`:

```
NODE_ENV=production
PORT=3000
BLOG_NAME=My Blog
BLOG_DESCRIPTION=A blog about technology
CORS_ORIGIN=https://myblog.com
```

### Production Build

Bun can compile your app into a single executable:

```bash
$ bun build src/index.ts --compile --outfile blog
```

This creates a standalone binary with no dependencies.

### Database

For production, consider:

1. **SQLite** (current) - Good for small to medium blogs
2. **PostgreSQL** - Better for high traffic
3. **Turso** - SQLite at the edge

If sticking with SQLite, ensure the database file is persistent and backed up.

## Deployment Options

### Option 1: VPS (DigitalOcean, Linode, etc.)

1. Create a server with Ubuntu/Debian
2. Install Bun:
   ```bash
   $ curl -fsSL https://bun.sh/install | bash
   ```

3. Clone your repository:
   ```bash
   $ git clone https://github.com/you/blog.git
   $ cd blog
   ```

4. Install dependencies:
   ```bash
   $ bun install --production
   ```

5. Create a systemd service `/etc/systemd/system/blog.service`:
   ```ini
   [Unit]
   Description=Blog
   After=network.target

   [Service]
   Type=simple
   User=www-data
   WorkingDirectory=/var/www/blog
   ExecStart=/home/user/.bun/bin/bun src/index.ts
   Restart=on-failure
   Environment=NODE_ENV=production
   Environment=PORT=3000

   [Install]
   WantedBy=multi-user.target
   ```

6. Start the service:
   ```bash
   $ sudo systemctl enable blog
   $ sudo systemctl start blog
   ```

7. Set up Nginx as reverse proxy `/etc/nginx/sites-available/blog`:
   ```nginx
   server {
       listen 80;
       server_name myblog.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

8. Enable site and restart Nginx:
   ```bash
   $ sudo ln -s /etc/nginx/sites-available/blog /etc/nginx/sites-enabled/
   $ sudo nginx -t
   $ sudo systemctl restart nginx
   ```

9. Set up SSL with Let's Encrypt:
   ```bash
   $ sudo apt install certbot python3-certbot-nginx
   $ sudo certbot --nginx -d myblog.com
   ```

### Option 2: Docker

Create `Dockerfile`:

```dockerfile
FROM oven/bun:1

WORKDIR /app

COPY package.json bun.lockb ./
RUN bun install --production

COPY . .

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["bun", "src/index.ts"]
```

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  blog:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
    environment:
      - NODE_ENV=production
      - PORT=3000
    restart: unless-stopped
```

Build and run:

```bash
$ docker compose up -d
```

### Option 3: Fly.io

Create `fly.toml`:

```toml
app = "my-blog"
primary_region = "ord"

[build]
  builder = "heroku/buildpacks:20"

[env]
  NODE_ENV = "production"
  PORT = "8080"

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 0

[mounts]
  source = "data"
  destination = "/app/data"
```

Deploy:

```bash
$ fly launch
$ fly deploy
```

### Option 4: Railway

1. Connect your GitHub repository
2. Add environment variables in Railway dashboard
3. Deploy automatically on push

### Option 5: Render

Create `render.yaml`:

```yaml
services:
  - type: web
    name: blog
    env: node
    buildCommand: bun install
    startCommand: bun src/index.ts
    envVars:
      - key: NODE_ENV
        value: production
    disk:
      name: data
      mountPath: /app/data
      sizeGB: 1
```

## Production Checklist

### Security

- [ ] Enable HTTPS
- [ ] Set secure cookie options
- [ ] Configure CORS properly
- [ ] Use environment variables for secrets
- [ ] Rate limit API endpoints
- [ ] Validate all inputs

### Performance

- [ ] Enable gzip compression (via Nginx)
- [ ] Set cache headers for static files
- [ ] Use CDN for static assets
- [ ] Enable SQLite WAL mode
- [ ] Consider adding Redis for sessions

### Monitoring

- [ ] Set up health checks
- [ ] Configure logging
- [ ] Set up error alerting
- [ ] Monitor server resources

### Backup

- [ ] Backup database regularly
- [ ] Test restore procedures
- [ ] Set up automated backups

## Health Check Endpoint

Update the health endpoint for monitoring services:

```typescript
app.get("/health", (req, res) => {
  // Check database connection
  try {
    db.prepare("SELECT 1").get()
  } catch (error) {
    return res.status(503).json({
      status: "error",
      message: "Database unavailable",
    })
  }

  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    env: config.env,
  })
})
```

## Logging for Production

Update `src/middleware/logger.ts`:

```typescript
import type { Middleware } from "verb"
import { config } from "../config"

export const logger: Middleware = (req, res, next) => {
  const start = Date.now()
  const { method, path, ip } = req

  // Log after response
  const log = () => {
    const duration = Date.now() - start
    const timestamp = new Date().toISOString()

    // JSON format for production (easier to parse)
    if (config.env === "production") {
      console.log(
        JSON.stringify({
          timestamp,
          method,
          path,
          ip,
          duration,
          userAgent: req.headers.get("user-agent"),
        })
      )
    } else {
      console.log(`[${timestamp}] ${method} ${path} ${duration}ms`)
    }
  }

  // Hook into response methods
  const originalJson = res.json.bind(res)
  const originalSend = res.send.bind(res)
  const originalEnd = res.end.bind(res)

  res.json = (data) => {
    log()
    return originalJson(data)
  }

  res.send = (data) => {
    log()
    return originalSend(data)
  }

  res.end = () => {
    log()
    return originalEnd()
  }

  next()
}
```

## Summary

Your blog is now:

- Built and ready for production
- Deployable to multiple platforms
- Secured with HTTPS
- Monitored with health checks
- Logging in production format

Congratulations! You've built and deployed a complete blog with Verb.

## What's Next?

Ideas for extending your blog:

- **Comments** - Add a commenting system
- **Search** - Full-text search with SQLite FTS
- **RSS Feed** - Generate RSS for subscribers
- **Sitemap** - Auto-generate sitemap.xml
- **Analytics** - Track page views
- **Email** - Newsletter subscriptions
- **Images** - Upload and manage images
- **Drafts** - Preview drafts before publishing
- **Tags** - Add tags alongside categories
- **Pagination** - Paginate post lists

## Resources

- [Verb Documentation](https://github.com/verbjs/verb)
- [Bun Documentation](https://bun.sh/docs)
- [SQLite Documentation](https://sqlite.org/docs.html)

Thank you for reading!

[← Previous: Building the Blog](07-building-the-blog.md) | [Back to Index](index.md)
