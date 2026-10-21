#!/usr/bin/env bun
// Creates a known local test user for development.
// Local-only: never run this against a hosted Supabase project.

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

const email = process.env.TEST_USER_EMAIL ?? 'test@civpulse.org';
const password = process.env.TEST_USER_PASSWORD ?? 'civicpulse-test-123';
const displayName = process.env.TEST_USER_NAME ?? 'Test User';

const status = spawnSync('supabase', ['status', '-o', 'env'], {
  cwd: root,
  encoding: 'utf8',
});

if (status.status !== 0) {
  console.error('✖ Local Supabase is not running. Start it with `bun run db:start`.');
  process.exit(1);
}

const env = Object.fromEntries(
  status.stdout
    .split('\n')
    .filter((line) => line.includes('='))
    .map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^"|"$/g, '')];
    }),
);

const url = env.API_URL;
const anonKey = env.ANON_KEY;

if (!url || !anonKey) {
  console.error('✖ Could not read API_URL / ANON_KEY from `supabase status`.');
  process.exit(1);
}

const headers = { apikey: anonKey, 'Content-Type': 'application/json' };

async function signIn() {
  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email, password }),
  });
  return response.json().catch(() => ({}));
}

const signUpResponse = await fetch(`${url}/auth/v1/signup`, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    email,
    password,
    data: { display_name: displayName },
  }),
});

const signUpBody = await signUpResponse.json().catch(() => ({}));
let user = signUpBody.user;

if (!signUpResponse.ok) {
  const message = signUpBody.msg ?? signUpBody.message ?? 'unknown error';
  if (/already/i.test(message)) {
    const session = await signIn();
    user = session.user;
    if (!user) {
      console.error(`✖ User ${email} exists, but sign-in failed: ${session.msg ?? message}`);
      process.exit(1);
    }
    console.log(`▸ Test user ${email} already exists (signed in to confirm).`);
  } else {
    console.error(`✖ Signup failed: ${message}`);
    process.exit(1);
  }
} else {
  console.log(`▸ Created test user ${email}.`);
}

const profileResponse = await fetch(
  `${url}/rest/v1/profiles?id=eq.${user.id}&select=display_name`,
  { headers: { apikey: anonKey } },
);
const profiles = await profileResponse.json().catch(() => []);

if (!Array.isArray(profiles) || profiles.length === 0) {
  console.error('✖ Profile row was not created by the signup trigger.');
  process.exit(1);
}

// Admins are managed with the service role. The seed script is local-only.
const serviceKey = env.SERVICE_ROLE_KEY;
let isAdmin = false;
if (serviceKey) {
  const serviceHeaders = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
  const existing = await fetch(`${url}/rest/v1/admins?user_id=eq.${user.id}&select=user_id`, {
    headers: serviceHeaders,
  })
    .then((response) => response.json())
    .catch(() => []);

  if (Array.isArray(existing) && existing.length > 0) {
    isAdmin = true;
  } else {
    const granted = await fetch(`${url}/rest/v1/admins`, {
      method: 'POST',
      headers: { ...serviceHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id }),
    });
    if (!granted.ok) {
      console.error(`✖ Could not grant admin: ${await granted.text()}`);
      process.exit(1);
    }
    isAdmin = true;
  }
} else {
  console.warn('⚠ SERVICE_ROLE_KEY not found; skipping admin grant.');
}

console.log('\nLocal test user ready:');
console.log(`  email:        ${email}`);
console.log(`  password:     ${password}`);
console.log(`  display_name: ${profiles[0].display_name ?? '(none)'}`);
console.log(`  user id:      ${user.id}`);
console.log(`  admin:        ${isAdmin ? 'yes' : 'no'}`);
console.log('\nSign in at /signin/ once the dev server is running.');
