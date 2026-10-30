# Protected Vercel deployment

GitHub repository: https://github.com/Akshat9999572/linkweb

Vercel project: `linkweb` in `akshats-projects-1f5449d1`.

The project uses Vercel Authentication for **all deployments**. The application itself opens the personal profile automatically after Vercel verifies access. Do not disable the project's deployment protection while using personal mode.

## Components

- A Next.js web service in `apps/web`.
- A PostgreSQL database on Neon's Free plan, separate from the local database.
- A private Vercel Blob store for profile photos, uploads, screenshots, PDFs, reader data, and preserved HTML.
- A preservation daemon built from `Dockerfile.worker`. It includes Chromium and Monolith and runs the original background worker with concurrency limited to one.

Vercel Services and Daemons are currently public beta. Daemons consume the account's included CPU and provisioned-memory quotas even when idle. Hosting quotas are separate from the application's removed bookmark/subscription limits. No paid plan upgrade is configured by this repository.

## Deployment environment

Required: `DATABASE_URL`, `NEXTAUTH_SECRET`, `PERSONAL_MODE=true`, `PERSONAL_PROFILE_ID`, `PERSONAL_VERCEL_PROTECTED=true`, `STORAGE_BACKEND=vercel-blob`, and the connected Blob credentials. Store all credentials in Vercel's project environment, never in Git.

The build applies the original Prisma migrations and checks the selected personal profile before building Next.js. Provision the profile in the hosted database before the first deployment. The Vercel authentication provider accepts only the current deployment's system-provided hostnames when hosted automatic access is enabled.

`vercel.json` defines the web service, background daemon, and routing. A deployment requires the managed database integration to be installed successfully. The local database and `.env` are intentionally excluded from uploads.

## Local development

`start-local.cmd` continues to run the app with the local PostgreSQL database and local disk storage. Hosted environment files use `.env.vercel.local`, are ignored by Git, and are not used by the local launcher.

## Verification before release

1. Confirm Vercel Authentication still protects all deployments.
2. Confirm migrations and personal-profile provisioning complete against the hosted database.
3. Confirm the web service and preservation daemon build successfully.
4. Confirm an unauthenticated public request is denied by Vercel.
5. Through authorized access, check the default profile, bookmark persistence, and generated archive previews.

The private Blob adapter has been checked against the real store for upload, read, existence, move, and folder deletion. Folder deletion also checks that a similarly named sibling folder is retained.
