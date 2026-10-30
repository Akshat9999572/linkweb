# Hostinger deployment

## Business-plan adaptation

Account inspection found Business web hosting and no VPS. `shared-server.cjs` runs the original Next.js application as one Node.js service with hosting-level password protection. `scripts/build-hostinger.mjs` builds it using the existing PostgreSQL database and archive store. `prepare-source.cjs` makes a web-only source package so unrelated mobile/extension workspaces and the worker are not installed on the shared plan. Generate a staged npm lockfile with `npm install --package-lock-only --ignore-scripts` before archiving. This artifact uses npm because Hostinger's Yarn installer supplies a legacy flag that Yarn 4 rejects; the repository's Yarn setup remains unchanged.

Target: `https://moccasin-chamois-968319.hostingersite.com`, a new free subdomain on the existing Business plan. The Business plan does not support always-running background workers. This migration retains the existing external archive worker, database and archive store, as selected by the owner. The VPS files below remain available for a future VPS migration. No new plan or server is purchased by these scripts.

The shared service requires `LINKWEB_ACCESS_USER`, `LINKWEB_ACCESS_PASSWORD_HASH` (SHA-256 of a randomly generated high-entropy access password), `PERSONAL_PROXY_HOST`, `PERSONAL_PROXY_SECRET`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `PERSONAL_MODE=true`, `PERSONAL_PROFILE_ID`, and the existing database/Blob credentials. Set `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` for dependency installation. Never deploy the source as a static website.

Build settings: Node.js 22, npm, root `.`, build script `build`, application type `express`, output `.`, entry `hostinger/shared-server.cjs`. A successful live build and private-access checks are required before calling the migration complete.

Verified deployment: `01a18df9-6c1b-73d7-8648-90ccdf28fa1a` completed successfully. Fifteen live HTTP/API/data/worker checks passed, including the dashboard and profile documents, JavaScript/CSS delivery, anonymous-access denial, bookmark editing and annotation, archived-text search, combined filters, all four archive formats and downloads, and nested collection deletion returning HTTP 200. Temporary test data and archive files were removed. The original React components and styles were unchanged by the hosting adapter.

Hosting-access credentials are stored locally in the ignored `local-runtime/hostinger-access.txt`; they are not in this repository. The application opens the persistent personal profile automatically after hosting access succeeds. The existing external archive worker remains in use. AI is disabled.

The shared server changes its working directory to `apps/web` before preparing Next.js, matching the original `next start` behavior. A real HTTP startup regression test covers translation-file resolution as well as the separate access-gate tests. Hostinger runtime-log retrieval intermittently returned provider API errors during verification, so successful workflow checks do not imply a complete log audit. The build also reported upstream npm dependency-audit advisories; forced dependency upgrades were not applied in this deployment.

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
