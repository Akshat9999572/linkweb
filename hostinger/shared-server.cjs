const http = require("node:http");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { accessGate } = require("./shared-access.cjs");

const root = path.resolve(__dirname, "..");
const gate = accessGate({
  username: process.env.LINKWEB_ACCESS_USER,
  passwordHash: process.env.LINKWEB_ACCESS_PASSWORD_HASH,
  proxySecret: process.env.PERSONAL_PROXY_SECRET,
  host: process.env.PERSONAL_PROXY_HOST,
});

(async () => {
  const authUrl = new URL(process.env.NEXTAUTH_URL);
  if (
    authUrl.protocol !== "https:" ||
    authUrl.host !== process.env.PERSONAL_PROXY_HOST
  )
    throw new Error("Personal access requires HTTPS on the configured domain.");
  process.env.PERSONAL_MODE = "true";
  const { ensurePersonalProfile } = await import(
    pathToFileURL(path.join(root, "local-runtime/personal-profile.mjs"))
  );
  await ensurePersonalProfile(root, { persist: false });
  const webRoot = path.join(root, "apps/web");
  // Match `next start` from the web workspace: next-i18next and public assets
  // resolve their paths from the working directory at request time.
  process.chdir(webRoot);
  const app = require("next")({ dev: false, dir: webRoot });
  const handle = app.getRequestHandler();
  await app.prepare();
  const server = http.createServer(async (req, res) => {
    if (!gate(req, res)) return;
    try {
      await handle(req, res);
    } catch {
      console.error("Linkweb request failed.");
      if (!res.headersSent) res.writeHead(500);
      res.end("Request failed.");
    }
  });
  server.listen(Number(process.env.PORT) || 3000, "0.0.0.0", () => {
    console.log("Private Linkweb web service is ready.");
  });
  process.on("SIGTERM", () => server.close(() => process.exit(0)));
})().catch((error) => {
  console.error("Linkweb startup failed:", error.message);
  process.exit(1);
});
