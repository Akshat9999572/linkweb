import EmbeddedPostgres from 'embedded-postgres';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { ensurePersonalProfile } from './personal-profile.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
process.env.PATH = path.join(root, 'local-runtime/bin') + path.delimiter + process.env.PATH;
if (!fs.existsSync('.env')) {
  const password = crypto.randomBytes(24).toString('hex');
  fs.writeFileSync('.env', [
    'NEXTAUTH_URL=http://localhost:3000/api/v1/auth',
    `NEXTAUTH_SECRET=${crypto.randomBytes(32).toString('hex')}`,
    `DATABASE_URL=postgresql://postgres:${password}@127.0.0.1:55432/linkwarden`,
    'NEXT_PUBLIC_CREDENTIALS_ENABLED=true',
    'PERSONAL_MODE=true',
    'STORAGE_FOLDER=./data',
    'PLAYWRIGHT_LAUNCH_OPTIONS_EXECUTABLE_PATH=C:/Program Files/Google/Chrome/Application/chrome.exe',
    ''
  ].join('\n'), { mode: 0o600 });
}
for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  if (!line.trim() || line.trimStart().startsWith('#')) continue;
  const index = line.indexOf('=');
  if (index > 0) process.env[line.slice(0, index)] = line.slice(index + 1);
}
const url = new URL(process.env.DATABASE_URL);
const pg = new EmbeddedPostgres({
  databaseDir: path.join(root, 'local-runtime/data'),
  user: url.username, password: url.password, port: Number(url.port),
  persistent: true, postgresFlags: ['-h', '127.0.0.1'],
  initdbFlags: ['--encoding=UTF8'],
  onLog: () => {}, onError: message => console.error(String(message))
});
const children = [];
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  await pg.stop();
  process.exit(0);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
function run(file, args, cwd = root) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [file, ...args], { cwd, env: process.env, stdio: 'inherit', windowsHide: true });
    children.push(child);
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`Command exited with ${code}`)));
  });
}
try {
  if (!fs.existsSync(path.join(root, 'local-runtime/data/PG_VERSION'))) await pg.initialise();
  await pg.start();
  const client = pg.getPgClient();
  await client.connect();
  const databaseName = url.pathname.slice(1);
  if (!/^[a-zA-Z0-9_]+$/.test(databaseName)) throw new Error('Invalid local database name');
  const result = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [databaseName]);
  if (!result.rowCount) await client.query(`CREATE DATABASE "${databaseName}" ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C' TEMPLATE template0`);
  await client.end();
  const prisma = path.join(root, 'node_modules/prisma/build/index.js');
  await run(prisma, ['generate', '--schema', 'packages/prisma/schema.prisma']);
  await run(prisma, ['migrate', 'deploy', '--schema', 'packages/prisma/schema.prisma']);
  await ensurePersonalProfile(root);
  console.log('\nLinkwarden: http://localhost:3000\n');
  if (fs.existsSync(path.join(root, 'local-runtime/bin/monolith.exe'))) {
    const require = createRequire(path.join(root, 'package.json'));
    run(require.resolve('tsx/cli'), ['worker.ts'], path.join(root, 'apps/worker')).catch(error => console.error('Worker stopped:', error.message));
  }
  await run(path.join(root, 'node_modules/next/dist/bin/next'), ['dev', '--hostname', '127.0.0.1', '--port', '3000'], path.join(root, 'apps/web'));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await pg.stop().catch(() => {});
}
