const { execFileSync } = require("node:child_process");
const path = require("node:path");
if (
  process.env.VERCEL !== "1" &&
  process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD !== "1"
) {
  execFileSync(
    process.execPath,
    [
      path.join(
        path.dirname(require.resolve("playwright/package.json")),
        "cli.js"
      ),
      "install",
      "--with-deps",
      "chromium",
    ],
    { stdio: "inherit" }
  );
}
