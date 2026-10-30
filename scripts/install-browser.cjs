const { execFileSync } = require("node:child_process");
if (
  process.env.VERCEL !== "1" &&
  process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD !== "1"
) {
  execFileSync(
    process.execPath,
    [require.resolve("playwright/cli"), "install", "--with-deps", "chromium"],
    { stdio: "inherit" }
  );
}
