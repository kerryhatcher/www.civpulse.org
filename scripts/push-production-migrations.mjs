#!/usr/bin/env bun
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repositoryUrl = 'https://github.com/kerryhatcher/www.civpulse.org.git';
const projectRef = 'drzcrodqflzkzzbqsags';

// Fail before starting Supabase (including for dry runs). Do not accept flags
// that redirect the target/workdir or include development seeds and roles.
export function pushProductionMigrations(args, {
  cwd = fileURLToPath(new URL('..', import.meta.url)),
  remote = repositoryUrl,
  push = command => execFileSync('supabase', command, {
    cwd, stdio: 'inherit', env: { ...process.env, SUPABASE_TELEMETRY_DISABLED: '1' },
  }),
} = {}) {
  for (const arg of args) {
    if (!['--dry-run', '--include-all'].includes(arg)) {
      throw new Error('Unsupported db:push option. Only --dry-run and --include-all are allowed.');
    }
  }
  const git = (...command) => execFileSync('git', command, {
    cwd, encoding: 'utf8', timeout: 30_000, stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
  const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
  if (branch !== 'main' && branch !== 'HEAD') {
    throw new Error('Production migrations require main or a detached main commit. Merge the migration PR first; use bun run db:migrate for local development.');
  }
  const dirty = git('status', '--porcelain', '--untracked-files=all', '--ignored', '--',
    'supabase/migrations', 'supabase/config.toml');
  if (dirty) throw new Error('Production migrations require clean migration files and config, including untracked/ignored files. Commit and merge them first.');
  const sha = git('rev-parse', 'HEAD');
  // Query the canonical repository, never trust a stale origin/main ref or a
  // caller's CI branch variables. Network/auth failures block the push.
  const main = git('ls-remote', '--exit-code', remote, 'refs/heads/main');
  if (main !== `${sha}\trefs/heads/main`) {
    throw new Error('This checkout is not GitHub’s current main commit. Update the checkout after merging before pushing production migrations.');
  }
  console.log(`Verified production migration source: main at ${sha}.`);
  return push(['db', 'push', '--project-ref', projectRef, '--workdir', cwd, ...args]);
}

if (import.meta.main) {
  try {
    pushProductionMigrations(process.argv.slice(2));
  } catch (error) {
    // Child-process exceptions can include captured output. Keep credentials and
    // connection details out of the wrapper's diagnostics.
    console.error(error.status !== undefined || error.code
      ? 'Production migration push blocked or failed. Verify GitHub connectivity, checkout state, and Supabase credentials.'
      : error.message);
    process.exitCode = 1;
  }
}
