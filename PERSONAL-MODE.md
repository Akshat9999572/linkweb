# Personal workspace

The local launcher runs Linkwarden with one persistent personal profile. The dashboard opens without a login or registration form. **My Profile** at `/profile` lets you change your display name, photo, and language. The initial name is **Dr. Akshat Shukla**; if a profile already exists, the launcher preserves it and its saved work.

Implementation:

1. `PERSONAL_MODE=true` enables this behavior explicitly.
2. Startup selects the existing profile or creates it once, then persists `PERSONAL_PROFILE_ID` in `.env`.
3. The browser obtains the normal signed session automatically. Password entry is not required. The personal session provider accepts localhost and 127.0.0.1 only.
4. Normal API ownership checks remain in place. New account registration and deletion of the selected personal profile are disabled in personal mode.
5. Login, registration, password, and billing pages lead back to the dashboard. The profile menu has no logout or billing option.
6. Cloud billing and trial checks are disabled by the local launcher. Personal mode removes bookmark, archive-count, and RSS-subscription quotas. File size and URL validation remain operational.

All included self-hosted features are available without a subscription: collections, tagging, preservation, reader/annotations, imports/exports, and RSS. AI tagging still requires an Ollama instance or another configured AI provider. This does not include third-party hosted infrastructure or paid external services.

Double-click `start-local.cmd` to run. The web app and database listen on loopback only. This no-login setup is intended for this computer. Set `PERSONAL_MODE=false` and restart to restore the original multi-user login flow.

No database schema changes are required. Profile edits and existing bookmarks persist across restarts.
