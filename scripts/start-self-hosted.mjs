import { execFileSync, spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensurePersonalProfile } from "../local-runtime/personal-profile.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);
const require = createRequire(import.meta.url);
for (const key of ["DATABASE_URL", "NEXTAUTH_SECRET", "NEXTAUTH_URL"])
  if (!process.env[key]) throw new Error(`Missing ${key}`);
if (process.env.PERSONAL_MODE === "true") {
  if (
    !process.env.PERSONAL_PROXY_HOST ||
    (process.env.PERSONAL_PROXY_SECRET?.length || 0) < 32
  )
    throw new Error("Personal mode requires the protected reverse proxy.");
  const url = new URL(process.env.NEXTAUTH_URL);
  if (url.protocol !== "https:" || url.host !== process.env.PERSONAL_PROXY_HOST)
    throw new Error("NEXTAUTH_URL must use HTTPS on PERSONAL_PROXY_HOST.");
}
execFileSync(
  process.execPath,
  [
    require.resolve("prisma/build/index.js"),
    "migrate",
    "deploy",
    "--schema",
    "packages/prisma/schema.prisma",
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL:
        process.env.DATABASE_URL_UNPOOLED ||
        process.env.POSTGRES_URL_NON_POOLING ||
        process.env.DATABASE_URL,
    },
  }
);
await ensurePersonalProfile(root, { persist: false });

const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
  const timeout = setTimeout(() => {
    for (const child of children) child.kill("SIGKILL");
    process.exit(code);
  }, 10000);
  Promise.all(
    children.map((child) =>
      child.exitCode !== null || child.signalCode !== null
        ? Promise.resolve()
        : new Promise((resolve) => child.once("exit", resolve))
    )
  ).then(() => {
    clearTimeout(timeout);
    process.exit(code);
  });
}
process.on("SIGTERM", () => stop());
process.on("SIGINT", () => stop());
for (const [file, args, directory] of [
  [
    require.resolve("next/dist/bin/next"),
    ["start", "--hostname", "0.0.0.0", "--port", "3000"],
    "apps/web",
  ],
  [require.resolve("tsx/cli"), ["worker.ts"], "apps/worker"],
]) {
  const child = spawn(process.execPath, [file, ...args], {
    cwd: path.join(root, directory),
    env: process.env,
    stdio: "inherit",
  });
  children.push(child);
  child.on("error", () => stop(1));
  child.on("exit", (code) => {
    if (!stopping) stop(code || 1);
  });
}
