#!/usr/bin/env bun
// Fail if any GitHub Action in .github/workflows is not pinned to a full commit SHA.
// Run with `bun run check:pins`.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dir = join(root, '.github', 'workflows');
const SHA = /^[0-9a-f]{40}$/;

const violations = [];
let checked = 0;

for (const file of readdirSync(dir)) {
  if (!/\.ya?ml$/.test(file)) continue;
  const lines = readFileSync(join(dir, file), 'utf8').split('\n');

  lines.forEach((line, index) => {
    const match = line.match(/^\s*(?:-\s*)?uses:\s*(\S+)/);
    if (!match) return;

    const ref = match[1];
    // Local actions and Docker references are not versioned refs.
    if (ref.startsWith('./') || ref.startsWith('docker://')) return;

    checked += 1;
    const sha = ref.includes('@') ? ref.slice(ref.lastIndexOf('@') + 1) : '';
    if (!SHA.test(sha)) violations.push(`${file}:${index + 1}  ${ref}`);
  });
}

if (violations.length > 0) {
  console.error('GitHub Actions must be pinned to a full commit SHA:\n');
  for (const violation of violations) console.error(`  ✖ ${violation}`);
  console.error('\nPin them, e.g. uses: actions/checkout@<40-char-sha> # v4.4.0');
  process.exit(1);
}

console.log(`✓ ${checked} action reference${checked === 1 ? '' : 's'} pinned to a commit SHA.`);
