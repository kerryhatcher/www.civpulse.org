import { afterEach, expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pushProductionMigrations } from '../push-production-migrations.mjs';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'civpulse-migration-guard-'));
  roots.push(root);
  const cwd = join(root, 'checkout');
  const remote = join(root, 'remote.git');
  mkdirSync(cwd);
  const git = (...args: string[]) => execFileSync('git', args, {
    cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' },
  }).trim();
  git('init', '-b', 'main');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'Guard test');
  git('config', 'core.hooksPath', '/dev/null');
  mkdirSync(join(cwd, 'supabase/migrations'), { recursive: true });
  const migration = join(cwd, 'supabase/migrations/20261026000000_test.sql');
  writeFileSync(migration, 'select 1;\n');
  writeFileSync(join(cwd, 'supabase/config.toml'), 'project_id = "test"\n');
  git('add', '.');
  git('commit', '-m', 'Initial migration');
  git('init', '--bare', remote);
  git('push', remote, 'main');
  let calls: string[][] = [];
  const run = (args: string[] = [], target = remote) => pushProductionMigrations(args, {
    cwd, remote: target, push: command => { calls.push(command); },
  });
  return { cwd, remote, git, migration, run, calls };
}

test('current clean main and detached main use the pinned production target', () => {
  const f = fixture();
  f.run(['--dry-run', '--include-all']);
  expect(f.calls).toEqual([['db', 'push', '--project-ref', 'drzcrodqflzkzzbqsags', '--workdir', f.cwd, '--dry-run', '--include-all']]);
  f.git('checkout', '--detach');
  f.run();
  expect(f.calls).toHaveLength(2);
});

test('feature branches cannot push, including dry runs and committed migrations', () => {
  const f = fixture();
  f.git('checkout', '-b', 'feature');
  writeFileSync(join(f.cwd, 'supabase/migrations/20261027000000_feature.sql'), 'select 2;\n');
  f.git('add', '.');
  f.git('commit', '-m', 'Feature migration');
  expect(() => f.run()).toThrow('Merge the migration PR first');
  expect(() => f.run(['--dry-run'])).toThrow('Merge the migration PR first');
  expect(f.calls).toHaveLength(0);
});

test('unpublished commits fail even when the checkout is named main', () => {
  const f = fixture();
  writeFileSync(f.migration, 'select 2;\n');
  f.git('commit', '-am', 'Not pushed');
  expect(() => f.run()).toThrow('current main commit');
  f.git('checkout', '--detach');
  expect(() => f.run()).toThrow('current main commit');
  expect(f.calls).toHaveLength(0);
});

test('stale main cannot rely on a cached remote ref', () => {
  const f = fixture();
  const old = f.git('rev-parse', 'HEAD');
  f.git('commit', '--allow-empty', '-m', 'New remote main');
  f.git('push', f.remote, 'main');
  f.git('reset', '--hard', old);
  expect(() => f.run()).toThrow('current main commit');
  expect(f.calls).toHaveLength(0);
});

test('unstaged, staged, deleted and untracked migration changes block the CLI', () => {
  for (const kind of ['unstaged', 'staged', 'deleted', 'untracked', 'config', 'ignored']) {
    const f = fixture();
    if (kind === 'deleted') rmSync(f.migration);
    else if (kind === 'untracked' || kind === 'ignored') {
      if (kind === 'ignored') writeFileSync(join(f.cwd, '.git/info/exclude'), '*.sql\n');
      writeFileSync(join(f.cwd, 'supabase/migrations/20261027000000_new.sql'), 'select 2;\n');
    } else if (kind === 'config') writeFileSync(join(f.cwd, 'supabase/config.toml'), 'project_id = "other"\n');
    else writeFileSync(f.migration, 'select 2;\n');
    if (kind === 'staged') f.git('add', '.');
    expect(() => f.run()).toThrow('clean migration files and config');
    expect(f.calls).toHaveLength(0);
  }
});

test('unreachable remote fails closed before invoking Supabase', () => {
  const f = fixture();
  expect(() => f.run([], join(f.cwd, 'missing-remote'))).toThrow();
  expect(f.calls).toHaveLength(0);
});

test('target, workdir, seed, role and arbitrary option overrides are rejected', () => {
  const f = fixture();
  for (const option of ['--db-url', '--linked', '--local', '--project-ref', '--workdir', '--include-seed', '--include-roles', '--yes', '--']) {
    expect(() => f.run([option])).toThrow('Unsupported db:push option');
  }
  expect(f.calls).toHaveLength(0);
});

test('CLI failure is propagated rather than reported as a successful push', () => {
  const f = fixture();
  expect(() => pushProductionMigrations([], {
    cwd: f.cwd, remote: f.remote, push: () => { throw new Error('CLI failed'); },
  })).toThrow('CLI failed');
});
