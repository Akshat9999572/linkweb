const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { createHash, randomInt } = require("node:crypto");

test("the deployed server resolves translation files from the web workspace", async () => {
  const project = path.resolve(__dirname, "..");
  const fixtureRoot = path.join(project, "local-runtime");
  const stage = fs.mkdtempSync(
    path.join(fixtureRoot, "hostinger-startup-test-")
  );
  const port = randomInt(30000, 45000);
  const password = "temporary-startup-regression-password";
  let child;
  try {
    for (const directory of [
      "hostinger",
      "apps/web",
      "local-runtime",
      "node_modules/next",
    ])
      fs.mkdirSync(path.join(stage, directory), { recursive: true });
    for (const file of ["shared-server.cjs", "shared-access.cjs"])
      fs.copyFileSync(
        path.join(__dirname, file),
        path.join(stage, "hostinger", file)
      );
    fs.writeFileSync(
      path.join(stage, "local-runtime/personal-profile.mjs"),
      "export async function ensurePersonalProfile() {}"
    );
    fs.writeFileSync(
      path.join(stage, "apps/web/next-i18next.config.js"),
      "translation-path-ok"
    );
    fs.writeFileSync(
      path.join(stage, "node_modules/next/index.js"),
      `module.exports = () => ({ prepare: async () => {}, getRequestHandler: () => (req, res) => res.end(require('node:fs').readFileSync('next-i18next.config.js', 'utf8')) });`
    );
    child = spawn(process.execPath, ["hostinger/shared-server.cjs"], {
      cwd: stage,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        PORT: String(port),
        NEXTAUTH_URL: "https://bookmarks.example.com/api/v1/auth",
        LINKWEB_ACCESS_USER: "owner",
        LINKWEB_ACCESS_PASSWORD_HASH: createHash("sha256")
          .update(password)
          .digest("hex"),
        PERSONAL_PROXY_HOST: "bookmarks.example.com",
        PERSONAL_PROXY_SECRET: "x".repeat(64),
      },
    });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Startup fixture timed out")),
        10000
      );
      child.stdout.on("data", (data) => {
        if (data.toString().includes("web service is ready")) {
          clearTimeout(timer);
          resolve();
        }
      });
      child.once("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.once("exit", (code) => {
        clearTimeout(timer);
        if (code) reject(new Error("Startup fixture failed"));
      });
    });
    const response = await fetch("http://127.0.0.1:" + port + "/dashboard", {
      headers: {
        Authorization:
          "Basic " + Buffer.from("owner:" + password).toString("base64"),
      },
    });
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "translation-path-ok");
  } finally {
    if (child && child.exitCode === null) {
      await new Promise((resolve) => {
        child.once("exit", resolve);
        child.kill("SIGTERM");
      });
    }
    const relative = path.relative(fixtureRoot, stage);
    assert.ok(
      !relative.startsWith("..") &&
        !path.isAbsolute(relative) &&
        relative.startsWith("hostinger-startup-test-")
    );
    fs.rmSync(stage, { recursive: true, force: true });
  }
});
