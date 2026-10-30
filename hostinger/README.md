# Hostinger VPS deployment

## Business-plan adaptation

Account inspection found Business web hosting and no VPS. `shared-server.cjs` runs the original Next.js application as one Node.js service with hosting-level password protection. `scripts/build-hostinger.mjs` builds it using the existing PostgreSQL database and archive store. `prepare-source.py` makes a web-only source package so unrelated mobile/extension workspaces and the worker are not installed on the shared plan. Update the staged Yarn lockfile before archiving.

The Business plan does not support always-running background workers. The website can use the existing external archive worker, or automatic preservation can be paused; this choice must be made explicitly before deployment. The VPS files below remain available for a future VPS migration. No new plan or server is purchased by these scripts.

The shared service requires `LINKWEB_ACCESS_USER`, `LINKWEB_ACCESS_PASSWORD_HASH` (SHA-256 of a randomly generated high-entropy access password), `PERSONAL_PROXY_HOST`, `PERSONAL_PROXY_SECRET`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `PERSONAL_MODE=true`, `PERSONAL_PROFILE_ID`, and the existing database/Blob credentials. Set `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` for dependency installation. Never deploy the source as a static website.

Build settings: Node.js 22, Yarn, root `.`, build script `build`, application type `express`, output `.`, entry `hostinger/shared-server.cjs`. These are a prepared configuration; a successful live build and private-access checks are required before calling the migration complete.

## VPS configuration

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
