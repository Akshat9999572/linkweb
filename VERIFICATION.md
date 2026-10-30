# Local verification

Source: https://github.com/linkwarden/linkwarden at commit `eff7c6b`, retaining its AGPL-3.0 license. Local changes provide Windows startup, PostgreSQL, and a personal workspace with automatic login, an editable default profile, and no cloud billing or bookmark/RSS quotas. See `PERSONAL-MODE.md` and `local-runtime/personal-verification.json` for the personal-mode behavior and latest browser checks.

Personal-mode verification on 2026-10-30:

- A fresh browser opens the dashboard without showing login or registration forms.
- My Profile saves display-name edits through the API and persists them after reload.
- The profile fits a 390px mobile viewport; desktop and mobile screenshots were reviewed.
- Collections and bookmarks save without entering credentials.
- Additional account registration and deletion of the selected personal profile are blocked.
- A second browser session automatically opens the same profile.
- No browser JavaScript errors were observed during the checks.
- Personal mode disables subscription and credit-card requirements, including when billing configuration is present.
- A bookmark import larger than the standard quota is allowed in personal mode; no records were imported by this quota check.
- Repeated startup keeps the same profile ID, edited name, and user count.
- The temporary verification collection was removed, and the original profile name was restored.

The original API ownership and signed-session checks are retained. AI services still require an actual configured provider.

Initial clone verification on 2026-10-30 (before personal-mode customization):

- Registration through the original browser form creates an account.
- Login opens the dashboard using the original authentication and navigation.
- Authenticated collection, bookmark, and tag creation writes to PostgreSQL.
- Saved bookmark renders after navigation and persists after reload.
- Database search returns the bookmark.
- The original responsive interface fits a 390px mobile viewport.
- No browser JavaScript errors during the final check.
- Hindi, Arabic, and emoji text round-trip through the UTF-8 database.
- The preservation worker generates JPEG screenshot, PDF, single-file HTML, and readability JSON.
- The browser successfully loads the generated archive preview with HTTP 200.
- App and database listen only on loopback ports 3000 and 55432.
- JavaScript syntax checks and `git diff --check` pass.

REA MCP was used to inspect the original demo's login and authenticated dashboard. Retained dashboard evidence is in `local-runtime/rea-reference.json`. Browser results are in `local-runtime/verification.json`, archive references in `local-runtime/preservation-verification.json`, and screenshots in `local-runtime/local-desktop.png` and `local-runtime/local-mobile.png`.

The active database uses UTF-8 explicitly because the initial Windows PostgreSQL defaults rejected non-English content. The initial test database is retained separately. Clone-verification accounts were removed before the personal profile was provisioned. Personal-mode tests preserve the real personal profile.

The initial local checks above predated the protected Vercel deployment described in `DEPLOYMENT.md`. Optional Meilisearch, email, AI, and payment integrations are not configured.

## Bookmark regression fixes (2026-10-30)

- Collection deletion uses one database transaction for the whole collection tree, related data and navigation. Archive/search cleanup runs after commit, with retries for transient failures.
- Database search includes archived page text, words and quoted phrases, and the existing field operators. Collection, tag, pin and text filters apply together.
- The original UI components, styles and layout are unchanged by these fixes. AI remains disabled without a configured provider.
- Eight regression tests use isolated temporary users in a local PostgreSQL database. They cover nested deletion, transaction rollback, cleanup retries, membership permissions, archived text, combined filters, pagination and public visibility.
- The regression tests plus existing archive/configuration tests pass: 25 tests across six files. The production TypeScript check also passes.

## Hostinger verification (2026-10-30)

The website was deployed to `https://moccasin-chamois-968319.hostingersite.com` on the existing Business plan, retaining the existing external archive worker, PostgreSQL database and private Blob storage. No existing Hostinger website was replaced.

Fifteen live checks passed: private access and source/API denial, automatic profile access, rendered page documents and frontend assets, nested collections, bookmark editing, tags, pins, annotations, archived-page text search, combined filters, all four archive formats, authenticated downloads, and nested deletion with HTTP 200 and complete test-data/file cleanup. AI and billing remain disabled. The hosting access gate and runtime-directory regression tests also pass (five tests).

The original UI component/style files were not changed. This audit used live HTTP/API/database/worker checks; browser click interactions and visual layout comparison were not re-run. Hostinger's runtime-log API returned provider errors during the final scan. The build reported npm dependency-audit advisories which remain untriaged; no forced dependency upgrades were made. Further details and the private access file location are in `hostinger/README.md`.
