# Local Linkwarden

This is a clone of https://github.com/linkwarden/linkwarden, retaining its original interface, backend, source history, and AGPL-3.0 license.

## Scope and plan

Run the real bookmark application with one persistent personal profile: dashboard, collections, links, tags, search, reader, settings, and the original responsive light/dark interface. Login is automatic, registration and cloud billing are disabled, and bookmark/RSS quotas are removed. Use **My Profile** to edit your name, photo, and language. See [PERSONAL-MODE.md](PERSONAL-MODE.md) for details.

1. Clone the upstream repository into its own folder.
2. Inspect the public demo with REA MCP.
3. Install the web and worker dependencies and a local PostgreSQL runtime.
4. Generate local credentials, apply the original database migrations, and start the application.
5. Check automatic opening, persistent profile edits, link creation, collections, search, and mobile layout.

## Start

Double-click `start-local.cmd`, or run `powershell -ExecutionPolicy Bypass -File .\start-local.ps1` from this folder. Open http://localhost:3000; your personal dashboard opens automatically. Edit your profile at http://localhost:3000/profile. Keep the terminal open while using the app. Ctrl+C stops the application. Your database and saved files persist under `local-runtime/data` and `data`.

The launcher creates `.env` on first run with random local credentials. These credentials are never displayed. PostgreSQL listens only on 127.0.0.1:55432. The web app listens only on 127.0.0.1:3000.

The launcher also starts the preservation worker when `local-runtime/bin/monolith.exe` is present. This checkout includes Monolith CLI 2.11.7 downloaded from its official GitHub release; Chromium uses the installed Google Chrome. Meilisearch, AI providers, email delivery, and cloud billing are optional integrations; basic bookmark search uses the application's database fallback.

## REA reference

The public demo at https://demo.linkwarden.app/login was inspected with `list_browser_targets` and `inspect_web_page` on 2026-10-30. It uses the original Linkwarden login, Next.js scripts, and styles. Evidence ID: `ev_ad22058af6a598eb00de1b8c25f076d65cc670e3fa7fcdfb41a8c7228c38cce1`. The inspection was passive and limited to the current page; it did not establish authenticated behavior. Local verification is recorded separately.
