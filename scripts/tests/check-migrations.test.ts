import { expect, test } from 'bun:test';
import { migrationCheckState, waitForMigrations, assertUniqueMigrationVersions } from '../check-migrations.mjs';
import { readdirSync } from 'node:fs';

test('checked-in migrations have unique versions; conflicting filenames fail before deployment', () => {
  expect(() => assertUniqueMigrationVersions(readdirSync(new URL('../../supabase/migrations/', import.meta.url)))).not.toThrow();
  expect(() => assertUniqueMigrationVersions(['20261123090000_first.sql', '20261123090000_second.sql'])).toThrow('Duplicate migration version 20261123090000');
  expect(() => assertUniqueMigrationVersions(['README.md', '20261123090000_first.sql', '20261123090100_second.sql'])).not.toThrow();
});

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

test('waits for primary rate-limit reset before rechecking the exact commit', async () => {
  let time = 1_000_000;
  const sleeps: number[] = [];
  let requests = 0;
  await waitForMigrations(sha, {
    now: () => time,
    sleep: async ms => { sleeps.push(ms); time += ms; },
    fetchChecks: async (url, options) => {
      expect(String(url)).toContain(`/commits/${sha}/check-runs`);
      expect(options.headers.Authorization).toBe('Bearer test-only-token');
      return ++requests === 1 ? new Response('{}', { status: 403, headers: {
        'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1005',
      } }) : response([run()]);
    },
    token: 'test-only-token',
  });
  expect(sleeps).toEqual([6000]);
  expect(requests).toBe(2);
});

test('honors Retry-After and secondary-limit backoff without accepting an error response', async () => {
  for (const status of [403, 429]) {
    let requests = 0;
    const sleeps: number[] = [];
    let time = 0;
    await waitForMigrations(sha, {
      now: () => time,
      sleep: async ms => { sleeps.push(ms); time += ms; },
      fetchChecks: async () => ++requests === 1
        ? new Response('{}', { status, headers: { 'Retry-After': '2' } }) : response([run()]),
    });
    expect(sleeps).toEqual([2000]);
  }
  let requests = 0;
  let time = 0;
  const sleeps: number[] = [];
  await waitForMigrations(sha, {
    now: () => time,
    sleep: async ms => { sleeps.push(ms); time += ms; },
    fetchChecks: async () => ++requests <= 2
      ? new Response(JSON.stringify({ message: 'You have exceeded a secondary rate limit.' }), { status: 403 })
      : response([run()]),
  });
  expect(sleeps).toEqual([60_000, 120_000]);
});

test('rate limiting cannot bypass timeout, failed checks or missing checks', async () => {
  let time = 0;
  let requests = 0;
  const options = {
    now: () => time,
    sleep: async (ms: number) => { time += ms; },
    timeoutMs: 5000,
  };
  await expect(waitForMigrations(sha, { ...options,
    fetchChecks: async () => new Response('{}', { status: 403, headers: {
      'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '60',
    } }),
  })).rejects.toThrow('exceeds the deployment wait budget');
  expect(time).toBe(0);
  await expect(waitForMigrations(sha, { ...options,
    fetchChecks: async () => ++requests === 1
      ? new Response('{}', { status: 429, headers: { 'Retry-After': '1' } })
      : response([run({ conclusion: 'failure' })]),
  })).rejects.toThrow('Deployment blocked');
  time = 0;
  requests = 0;
  await expect(waitForMigrations(sha, { ...options,
    fetchChecks: async () => ++requests === 1
      ? new Response('{}', { status: 429, headers: { 'Retry-After': '1' } }) : response([]),
  })).rejects.toThrow('Timed out');
});

test('uses the later of Retry-After and primary reset, including HTTP dates', async () => {
  let time = 1_000_000;
  let requests = 0;
  const sleeps: number[] = [];
  await waitForMigrations(sha, {
    now: () => time,
    sleep: async ms => { sleeps.push(ms); time += ms; },
    fetchChecks: async () => ++requests === 1
      ? new Response('{}', { status: 403, headers: {
        'Retry-After': new Date(1_002_000).toUTCString(),
        'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1005',
      } }) : response([run()]),
  });
  expect(sleeps).toEqual([6000]);
});

test('limits retries even when the API supplies a short Retry-After', async () => {
  let time = 0;
  let requests = 0;
  await expect(waitForMigrations(sha, {
    now: () => time,
    sleep: async ms => { time += ms; },
    fetchChecks: async () => {
      requests++;
      return new Response('{}', { status: 429, headers: { 'Retry-After': '1' } });
    },
  })).rejects.toThrow('exceeds the deployment wait budget');
  expect(requests).toBe(5);
});
