# Hostinger VPS deployment

This configuration runs the existing Next.js interface and preservation worker on an existing AMD64 VPS using Docker Compose. It retains the current PostgreSQL database and private Blob archive store so existing bookmarks and files remain available. AI stays disabled unless provider settings are added explicitly.

## Access and prerequisites

Before deploying, inspect the selected VPS, available memory/disk, Docker installation, existing services and ports 80/443. Do not replace an existing website or reverse proxy. Choose a domain/subdomain pointing to this VPS; adapt the proxy integration if ports are already in use.

The application port is internal to Docker. Caddy provides HTTPS and password protection before forwarding to Linkweb. It also injects a secret header required to open the personal profile. This replaces Vercel's deployment protection while preserving the application's original interface and automatic personal session.

## Configuration

Copy `hostinger/environment.example` to `.env.hostinger` in the repository root. Populate it with the current database and Blob credentials through a secure server connection. Set the actual domain, a strong access password's bcrypt hash, and independent random proxy/session secrets. Keep the file readable only by its owner. The existing profile ID must point to the existing profile in the selected database.

Create the password hash using Caddy's interactive `caddy hash-password` command. Its output can be saved in single quotes in the environment file. Never put the plaintext password or database credentials in Git or shell history.

From the repository root, validate the Compose configuration and start it:

```sh
docker compose --env-file .env.hostinger -f hostinger/compose.yml config --quiet
docker compose --env-file .env.hostinger -f hostinger/compose.yml up -d --build
docker compose --env-file .env.hostinger -f hostinger/compose.yml ps
```

Startup applies existing Prisma migrations, verifies the persistent profile, and starts the web app and worker. A failure in either process restarts the container. On this deployment, the proxy host and an unguessable proxy secret are mandatory for personal mode.

## Verification and updates

Confirm unauthenticated HTTPS requests are denied by the proxy, authenticated requests open the existing profile, and bookmarks, archived-text search and nested collection deletion work. Check that the worker produces downloadable screenshot/PDF/HTML/reader files and remove only temporary test records.

Automatic Vercel Git deployments are disabled in `vercel.json`. Future updates can be pulled and rebuilt on this VPS. The original Vercel site and its resources are retained until the Hostinger deployment has been verified; stopping or deleting those resources is a separate action.

This configuration is prepared in the repository. Deployment requires access to the specific VPS and domain; it has not been built or run on a Hostinger server yet.
