#!/usr/bin/env bun
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const stopBackendOnExit =
  process.env.CIVICPULSE_STOP_BACKEND === '1' || process.argv.includes('--stop-backend');

/** Run a command to completion in the repo root. */
function run(command, args) {
  return spawnSync(command, args, { cwd: root, stdio: 'inherit' });
}

function backendIsRunning() {
  return spawnSync('supabase', ['status'], { cwd: root, stdio: 'ignore' }).status === 0;
}

function startBackend() {
  if (backendIsRunning()) {
    console.log('▸ Local Supabase is already running.');
    return false;
  }
  console.log('▸ Starting local Supabase (first run can take a minute)…');
  const result = run('supabase', ['start']);
  if (result.status !== 0) {
    console.error('\n✖ Could not start local Supabase. Fix the backend, then run `bun run dev` again.');
    process.exit(result.status ?? 1);
  }
  return true;
}

function stopBackend() {
  if (!stopBackendOnExit) {
    console.log('\n▸ Local Supabase is still running. Use `bun run db:stop` to stop it.');
    return;
  }
  console.log('\n▸ Stopping local Supabase…');
  run('supabase', ['stop']);
}

const startedBackend = startBackend();

const testEmail = process.env.TEST_USER_EMAIL ?? 'test@civpulse.org';
const testPassword = process.env.TEST_USER_PASSWORD ?? 'civicpulse-test-123';
console.log(`
▸ Local test user (admin):
    email:    ${testEmail}
    password: ${testPassword}
  Create it with \`bun run db:seed-user\` if it doesn't exist yet.\n`);

console.log('▸ Starting Astro dev server…\n');
const dev = spawn('bun', ['run', '--cwd', 'apps/web', 'dev'], {
  cwd: root,
  stdio: 'inherit',
  // Astro auto-detaches dev servers when it detects an AI agent. This wrapper
  // needs the server in the foreground so it can manage its lifetime.
  env: { ...process.env, ASTRO_DEV_BACKGROUND: '1' },
});

let stopping = false;

function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  dev.kill('SIGINT');
  if (startedBackend) stopBackend();
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

dev.on('exit', (code) => {
  if (stopping) return;
  stopping = true;
  if (startedBackend) stopBackend();
  process.exit(code ?? 0);
});
