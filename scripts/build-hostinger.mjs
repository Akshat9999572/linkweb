import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensurePersonalProfile } from "../local-runtime/personal-profile.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);
const require = createRequire(import.meta.url);
for (const key of ["DATABASE_URL", "NEXTAUTH_SECRET", "PERSONAL_PROFILE_ID"])
  if (!process.env[key]) throw new Error(`Missing deployment variable: ${key}`);
process.env.PERSONAL_MODE = "true";
process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = "1";
const prisma = require.resolve("prisma/build/index.js");
for (const args of [["generate"], ["migrate", "deploy"]]) {
  execFileSync(
    process.execPath,
    [prisma, ...args, "--schema", "packages/prisma/schema.prisma"],
    {
      stdio: "inherit",
      env:
        args[0] === "migrate"
          ? {
              ...process.env,
              DATABASE_URL:
                process.env.DATABASE_URL_UNPOOLED ||
                process.env.POSTGRES_URL_NON_POOLING ||
                process.env.DATABASE_URL,
            }
          : process.env,
    }
  );
}
await ensurePersonalProfile(root, { persist: false });
execFileSync(
  process.execPath,
  [require.resolve("next/dist/bin/next"), "build"],
  {
    cwd: path.join(root, "apps/web"),
    stdio: "inherit",
  }
);
