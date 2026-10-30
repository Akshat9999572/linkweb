import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

export async function ensurePersonalProfile(root) {
  if (process.env.PERSONAL_MODE !== 'true') return;
  const require = createRequire(path.join(root, 'package.json'));
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  try {
    const configuredId = Number(process.env.PERSONAL_PROFILE_ID);
    let user = configuredId
      ? await prisma.user.findUnique({ where: { id: configuredId } })
      : await prisma.user.findFirst({ orderBy: { id: 'asc' } });
    if (configuredId && !user) throw new Error('The configured personal profile is missing. Restore it before starting.');
    if (!user) {
      user = await prisma.user.create({ data: {
        username: 'personal', name: 'Dr. Akshat Shukla', emailVerified: new Date(),
        dashboardSections: { create: [
          { order: 0, type: 'STATS' },
          { order: 1, type: 'RECENT_LINKS' },
          { order: 2, type: 'PINNED_LINKS' }
        ] }
      } });
    }
    process.env.PERSONAL_PROFILE_ID = String(user.id);
    process.env.NEXT_PUBLIC_ADMIN = String(user.id);
    // The self-hosted personal workspace has no cloud subscription or trial.
    process.env.STRIPE_SECRET_KEY = '';
    process.env.NEXT_PUBLIC_STRIPE = 'false';
    process.env.NEXT_PUBLIC_REQUIRE_CC = 'false';
    process.env.NEXT_PUBLIC_EMAIL_PROVIDER = 'false';
    process.env.NEXT_PUBLIC_DISABLE_REGISTRATION = 'true';
    process.env.NEXT_PUBLIC_DEMO = 'false';
    const envPath = path.join(root, '.env');
    let env = fs.readFileSync(envPath, 'utf8');
    for (const [key, value] of Object.entries({ PERSONAL_MODE: 'true', PERSONAL_PROFILE_ID: String(user.id) })) {
      const pattern = new RegExp(`^${key}=.*$`, 'm');
      env = pattern.test(env) ? env.replace(pattern, `${key}=${value}`) : `${env.trimEnd()}\n${key}=${value}\n`;
    }
    fs.writeFileSync(envPath, env, { mode: 0o600 });
    console.log('Personal workspace ready. No login or subscription required.');
  } finally { await prisma.$disconnect(); }
}
