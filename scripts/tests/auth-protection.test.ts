import { expect, test } from 'bun:test';

// Read-only security probe: missing CAPTCHA must be rejected before user creation.
// Opt in against a local backend with AUTH_PROTECTION_TEST=1 and PUBLIC_SUPABASE_ANON_KEY.
test.skipIf(process.env.AUTH_PROTECTION_TEST !== '1')('direct Auth signup and password login reject missing CAPTCHA', async () => {
  const url = process.env.PUBLIC_SUPABASE_URL!;
  expect(['127.0.0.1', 'localhost']).toContain(new URL(url).hostname);
  const key = process.env.PUBLIC_SUPABASE_ANON_KEY!;
  for (const endpoint of ['signup', 'token?grant_type=password']) {
    const response = await fetch(`${url}/auth/v1/${endpoint}`, {
      method: 'POST',
      headers: { apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `captcha-missing-${crypto.randomUUID()}@example.test`, password: 'captcha-test-password-123' }),
    });
    expect(response.ok).toBe(false);
    expect(JSON.stringify(await response.json())).toContain('captcha');
  }
});
