// Require the running local backend and override deployed Worker vars explicitly.
import { execFileSync } from 'node:child_process';
const status = JSON.parse(execFileSync('bun', ['run', 'supabase', '--', 'status', '-o', 'json'], { encoding: 'utf8' }));
const url = status.API_URL;
const key = status.ANON_KEY ?? status.PUBLISHABLE_KEY;
if (!url || !key || !['localhost', '127.0.0.1'].includes(new URL(url).hostname)) {
  throw new Error('Start local Supabase before running cf:dev. Hosted backends are not allowed.');
}
const child = Bun.spawn(['bunx', 'wrangler', 'dev', '--var', `PUBLIC_SUPABASE_URL:${url}`, '--var', `PUBLIC_SUPABASE_ANON_KEY:${key}`], {
  cwd: new URL('../apps/web/', import.meta.url).pathname, stdin: 'inherit', stdout: 'inherit', stderr: 'inherit',
});
process.exit(await child.exited);
