import { expect, test } from 'bun:test';
import { migrationCheckState, waitForMigrations } from '../check-migrations.mjs';

const sha = 'a'.repeat(40);
const run = (changes = {}) => ({ id: 1, name: 'Supabase Preview', app: { id: 330661 }, head_sha: sha, status: 'completed', conclusion: 'success', ...changes });
const response = (runs: unknown[]) => new Response(JSON.stringify({ check_runs: runs }));

test('requires the trusted Supabase app, exact commit, and successful completion', () => {
  expect(migrationCheckState([run()], sha)).toBe('success');
  expect(migrationCheckState([], sha)).toBe('pending');
  expect(migrationCheckState([run({ head_sha: 'b'.repeat(40) })], sha)).toBe('pending');
  expect(migrationCheckState([run({ app: { id: 1 } })], sha)).toBe('pending');
  expect(migrationCheckState([run({ status: 'in_progress' })], sha)).toBe('pending');
  for (const conclusion of ['failure', 'skipped', 'neutral', 'cancelled', 'timed_out', null]) {
    expect(() => migrationCheckState([run({ conclusion })], sha)).toThrow('Deployment blocked');
  }
});

test('a newer rerun supersedes an old success', () => {
  expect(migrationCheckState([run(), run({ id: 2, status: 'queued' })], sha)).toBe('pending');
  expect(() => migrationCheckState([run(), run({ id: 2, conclusion: 'failure' })], sha)).toThrow();
});

test('waits for pending checks then permits deployment', async () => {
  let requests = 0;
  await waitForMigrations(sha, {
    fetchChecks: async () => response(++requests === 1 ? [] : [run()]),
    sleep: async () => {},
  });
  expect(requests).toBe(2);
});

test('fails closed on history mismatch, API errors, malformed responses, and timeout', async () => {
  const mismatch = run({ conclusion: 'failure', output: { summary: 'Remote migration versions not found in local migrations directory.' } });
  await expect(waitForMigrations(sha, { fetchChecks: async () => response([mismatch]) })).rejects.toThrow('Remote migration versions');
  await expect(waitForMigrations(sha, { fetchChecks: async () => new Response('', { status: 403 }) })).rejects.toThrow('HTTP 403');
  await expect(waitForMigrations(sha, { fetchChecks: async () => new Response('{}') })).rejects.toThrow('Invalid GitHub');
  let time = 0;
  await expect(waitForMigrations(sha, {
    fetchChecks: async () => response([]), now: () => time,
    sleep: async () => { time += 100; }, timeoutMs: 100,
  })).rejects.toThrow('Timed out');
  await expect(waitForMigrations('main')).rejects.toThrow('full commit SHA');
});
