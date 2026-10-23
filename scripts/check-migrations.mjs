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
  let rateLimitRetries = 0;
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
    if (!response.ok) {
      // A shared Cloudflare egress IP can exhaust GitHub's anonymous quota.
      // Retry only confirmed rate limits; a forbidden check is not permission to deploy.
      const retryAfter = response.headers.get('retry-after');
      const remaining = response.headers.get('x-ratelimit-remaining');
      const reset = response.headers.get('x-ratelimit-reset');
      let secondaryLimit = false;
      if (response.status === 403 && !retryAfter && remaining !== '0') {
        const error = await response.json().catch(() => null);
        secondaryLimit = typeof error?.message === 'string' && /secondary rate limit/i.test(error.message);
      }
      const rateLimited = response.status === 429 || (response.status === 403 &&
        (remaining === '0' || retryAfter !== null || secondaryLimit));
      if (!rateLimited) throw new Error(`GitHub checks API returned HTTP ${response.status}; deployment blocked. Check API permissions and credentials.`);
      const fallback = 60_000 * 2 ** rateLimitRetries++;
      const retryAt = retryAfter !== null && retryAfter.trim() !== '' && Number.isFinite(Number(retryAfter))
        ? now() + Math.max(0, Number(retryAfter)) * 1000
        : Date.parse(retryAfter ?? '');
      const resetAt = remaining === '0' && reset !== null && reset.trim() !== '' && Number.isFinite(Number(reset))
        ? Number(reset) * 1000 + 1000 : NaN;
      const delay = Math.max(1000, Number.isFinite(retryAt) ? retryAt - now() : 0,
        Number.isFinite(resetAt) ? resetAt - now() : 0,
        !Number.isFinite(retryAt) && !Number.isFinite(resetAt) ? fallback : 0);
      if (rateLimitRetries > 4 || delay >= deadline - now()) {
        throw new Error(`GitHub checks API rate limit (HTTP ${response.status}) exceeds the deployment wait budget; deployment blocked. Next retry: ${new Date(now() + delay).toISOString()}. Configure a repository-scoped GITHUB_TOKEN build secret with Checks read permission, or retry after the rate limit resets.`);
      }
      // Never print response bodies or credentials, including arbitrary error messages.
      console.log(`GitHub checks API rate limited (HTTP ${response.status}); retrying in ${Math.ceil(delay / 1000)} seconds.`);
      await sleep(delay);
      continue;
    }
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
