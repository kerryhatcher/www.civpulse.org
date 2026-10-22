#!/usr/bin/env bun
// Supabase's GitHub integration compares migration history and applies pending SQL.
// Require its success for this exact checkout before building/deploying production.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repository = 'kerryhatcher/www.civpulse.org';
const supabaseAppId = 330661;

export function migrationCheckState(runs, sha) {
  const matches = runs.filter(run => run.name === 'Supabase Preview'
    && run.app?.id === supabaseAppId && run.head_sha === sha);
  const latest = matches.sort((a, b) => b.id - a.id)[0];
  if (!latest || latest.status !== 'completed') return 'pending';
  if (latest.conclusion !== 'success') {
    throw new Error(`Supabase migration check ${latest.conclusion}. Deployment blocked. ${latest.details_url ?? ''}\n${latest.output?.summary ?? ''}`);
  }
  return 'success';
}

export async function waitForMigrations(sha, {
  fetchChecks = fetch,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
  now = Date.now,
  timeoutMs = 10 * 60 * 1000,
  token = process.env.GITHUB_TOKEN,
} = {}) {
  if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('A full commit SHA is required for the migration check.');
  const deadline = now() + timeoutMs;
  const url = `https://api.github.com/repos/${repository}/commits/${sha}/check-runs?check_name=Supabase%20Preview&filter=all&per_page=100`;
  console.log(`Waiting for Supabase migration validation of ${sha}…`);
  while (now() < deadline) {
    const response = await fetchChecks(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(Math.min(15_000, deadline - now())),
    });
    // Never log API response bodies: they are not needed to diagnose auth/rate limits.
    if (!response.ok) throw new Error(`GitHub checks API returned HTTP ${response.status}; deployment blocked. Check API access/rate limits and retry.`);
    const body = await response.json();
    if (!Array.isArray(body.check_runs)) throw new Error('Invalid GitHub checks response; deployment blocked.');
    if (migrationCheckState(body.check_runs, sha) === 'success') {
      console.log('Supabase migration check passed for this commit.');
      return;
    }
    await sleep(Math.min(30_000, Math.max(0, deadline - now())));
  }
  throw new Error('Timed out waiting for a successful Supabase migration check; deployment blocked. Check the Supabase GitHub integration and rerun the build.');
}

if (import.meta.main) {
  try {
    const cwd = fileURLToPath(new URL('..', import.meta.url));
    // Resolve the actual checkout, rather than trusting a branch name or stale CI variable.
    const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim();
    const dirtyMigrations = execFileSync('git', ['status', '--porcelain', '--', 'supabase/migrations'], { cwd, encoding: 'utf8' }).trim();
    if (dirtyMigrations) throw new Error('Commit migration changes before deployment; GitHub has not validated these local files.');
    await waitForMigrations(sha);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
