import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { ensurePersonalProfile } from "../local-runtime/personal-profile.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);
process.loadEnvFile(".env.vercel.local");
if (!process.env.DATABASE_URL)
  throw new Error(
    "The hosted DATABASE_URL is missing. Complete database provisioning and pull the production environment first."
  );
const database = new URL(process.env.DATABASE_URL);
if (["localhost", "127.0.0.1", "::1"].includes(database.hostname))
  throw new Error("Hosted provisioning refuses a local database.");
const require = createRequire(import.meta.url);
const prisma = require.resolve("prisma/build/index.js");
execFileSync(
  process.execPath,
  [prisma, "generate", "--schema", "packages/prisma/schema.prisma"],
  { stdio: "inherit" }
);
const migrationEnv = {
  ...process.env,
  DATABASE_URL:
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL,
};
execFileSync(
  process.execPath,
  [prisma, "migrate", "deploy", "--schema", "packages/prisma/schema.prisma"],
  { stdio: "inherit", env: migrationEnv }
);
process.env.PERSONAL_MODE = "true";
delete process.env.PERSONAL_PROFILE_ID;
const user = await ensurePersonalProfile(root, { persist: false });
fs.writeFileSync(
  ".vercel/personal-profile.json",
  JSON.stringify({ id: user.id })
);
console.log("Hosted personal profile provisioned. Profile ID:", user.id);
