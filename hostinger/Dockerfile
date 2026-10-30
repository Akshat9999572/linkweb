FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates openssl && rm -rf /var/lib/apt/lists/* && corepack enable
COPY package.json yarn.lock .yarnrc.yml ./
COPY apps/web/package.json ./apps/web/
COPY apps/worker/package.json ./apps/worker/
COPY packages/filesystem/package.json ./packages/filesystem/
COPY packages/lib/package.json ./packages/lib/
COPY packages/prisma/package.json ./packages/prisma/
COPY packages/router/package.json ./packages/router/
COPY packages/types/package.json ./packages/types/
COPY scripts/install-browser.cjs ./scripts/install-browser.cjs
RUN --mount=type=cache,sharing=locked,target=/root/.yarn/berry/cache corepack yarn workspaces focus @linkwarden/web @linkwarden/worker

FROM dependencies AS build
COPY . .
ENV PERSONAL_MODE=true NEXT_PUBLIC_CREDENTIALS_ENABLED=true NEXT_PUBLIC_DISABLE_REGISTRATION=true NEXT_PUBLIC_STRIPE=false NEXT_PUBLIC_EMAIL_PROVIDER=false NEXT_PUBLIC_DEMO=false
RUN node node_modules/prisma/build/index.js generate --schema packages/prisma/schema.prisma
RUN cd apps/web && node ../../node_modules/next/dist/bin/next build

FROM dependencies AS runtime
ARG TARGETARCH
RUN test "${TARGETARCH}" = "amd64" && curl -fsSL --retry 3 https://github.com/Y2Z/monolith/releases/download/v2.11.7/monolith-cli-linux-x86_64 -o /usr/local/bin/monolith && chmod +x /usr/local/bin/monolith
RUN node node_modules/playwright/cli.js install --with-deps chromium-headless-shell
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/web ./apps/web
COPY --from=build /app/apps/worker ./apps/worker
COPY --from=build /app/scripts/start-self-hosted.mjs ./scripts/start-self-hosted.mjs
COPY --from=build /app/local-runtime/personal-profile.mjs ./local-runtime/personal-profile.mjs
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "scripts/start-self-hosted.mjs"]
