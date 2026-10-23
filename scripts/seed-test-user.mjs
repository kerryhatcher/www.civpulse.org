#!/usr/bin/env bun
// Local-only bootstrap: create/confirm a known admin through the Auth admin API.
// Public signups still require CAPTCHA and email verification.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const email = process.env.TEST_USER_EMAIL ?? 'test@civpulse.org';
const password = process.env.TEST_USER_PASSWORD ?? 'civicpulse-test-123';
const displayName = process.env.TEST_USER_NAME ?? 'Test User';
const status = spawnSync('supabase', ['status', '-o', 'env'], { cwd: root, encoding: 'utf8' });
if (status.status !== 0) {
  console.error('✖ Local Supabase is not running. Start it with `bun run db:start`.');
  process.exit(1);
}
const env = Object.fromEntries(status.stdout.split('\n').filter(line => line.includes('=')).map(line => {
  const index = line.indexOf('=');
  return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^"|"$/g, '')];
}));
const url = env.API_URL;
const serviceKey = env.SERVICE_ROLE_KEY;
if (!url || !['127.0.0.1', 'localhost', '[::1]'].includes(new URL(url).hostname) || !serviceKey) {
  console.error('✖ Seeding requires a loopback Supabase API URL and its local service-role key.');
  process.exit(1);
}
const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };
async function request(path, options = {}) {
  const response = await fetch(`${url}${path}`, { ...options, headers: { ...headers, ...options.headers } });
  if (!response.ok) throw new Error(`Local seed request failed (${response.status}) at ${path.split('?')[0]}.`);
  return response.status === 204 ? null : response.json();
}
try {
  let user;
  for (let page = 1; ; page++) {
    const result = await request(`/auth/v1/admin/users?page=${page}&per_page=100`);
    user = result.users.find(item => item.email?.toLowerCase() === email.toLowerCase());
    if (user || result.users.length < 100) break;
  }
  const properties = { email, password, email_confirm: true, user_metadata: { display_name: displayName } };
  user = await request(user ? `/auth/v1/admin/users/${user.id}` : '/auth/v1/admin/users', {
    method: user ? 'PUT' : 'POST', body: JSON.stringify(properties),
  });
  const profiles = await request(`/rest/v1/profiles?id=eq.${user.id}&select=display_name`);
  if (!Array.isArray(profiles) || profiles.length !== 1) throw new Error('Profile signup trigger did not create the local profile.');
  await request('/rest/v1/admins', {
    method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ user_id: user.id }),
  });
  console.log(`Local test admin ready: ${email} / ${password}`);
  console.log('Sign in at /signin/ once the dev server is running.');
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
