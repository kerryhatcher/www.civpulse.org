#!/usr/bin/env bun
// Secret scanning with TruffleHog.
//
//   bun run secret:scan        # scan staged files (used by the pre-commit hook)
//   bun run secret:scan:all    # scan the full git history
//
// TruffleHog is a separate binary (https://github.com/trufflesecurity/trufflehog).
// Local-only artifacts such as `supabase/.temp` are skipped on purpose.

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const scanAll = process.argv.includes('--all');

const EXCLUDED = [
  /(^|\/)node_modules(\/|$)/,
  /(^|\/)dist(\/|$)/,
  /(^|\/)\.astro(\/|$)/,
  /(^|\/)\.wrangler(\/|$)/,
  /(^|\/)supabase\/\.temp(\/|$)/,
  /(^|\/)\.git(\/|$)/,
];

const RESULTS = ['--results=verified,unverified,unknown'];

function trufflehog(args, options = {}) {
  return spawnSync('trufflehog', args, { cwd: root, stdio: 'inherit', ...options });
}

const installed =
  spawnSync('trufflehog', ['--version'], { stdio: 'ignore' }).status === 0;

if (!installed) {
  const hint =
    'TruffleHog is not installed. See https://github.com/trufflesecurity/trufflehog#floppy_disk-installation';
  if (scanAll) {
    console.error(`✖ ${hint}`);
    process.exit(1);
  }
  console.warn(`⚠ ${hint}\n  Skipping secret scan.`);
  process.exit(0);
}

if (scanAll) {
  const result = trufflehog(['git', 'file://.', '--no-update', ...RESULTS, '--fail']);
  process.exit(result.status ?? 1);
}

// Staged files only, so the hook checks exactly what is about to be committed.
const diff = spawnSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'], {
  cwd: root,
  encoding: 'utf8',
});

if (diff.status !== 0) {
  console.error('✖ Could not read staged files from git.');
  process.exit(diff.status ?? 1);
}

const files = diff.stdout.split('\0').filter((path) => path && !EXCLUDED.some((re) => re.test(path)));

if (files.length === 0) {
  process.exit(0);
}

const result = trufflehog(['filesystem', '--no-update', ...RESULTS, '--fail', ...files]);

if ((result.status ?? 0) === 0) {
  process.exit(0);
}

console.error('\n✖ Secret scan failed. Remove the secret, or bypass a false positive with');
console.error('  `SKIP_SECRET_SCAN=1 git commit …` or `git commit --no-verify`.\n');
process.exit(result.status ?? 1);
