import { expect, test } from 'bun:test';
import { TURNSTILE_TEST_SITEKEY, turnstileSitekey } from '../../apps/web/src/lib/turnstile';

test('loopback Supabase uses the public test key without a production secret', () => {
  for (const host of ['localhost', '127.0.0.1', '[::1]']) {
    expect(turnstileSitekey(`http://${host}:54321`)).toBe(TURNSTILE_TEST_SITEKEY);
  }
});
test('hosted builds require a real Turnstile sitekey and reject test keys', () => {
  const url = 'https://example.supabase.co';
  expect(() => turnstileSitekey(url)).toThrow();
  expect(() => turnstileSitekey(url, '  ')).toThrow();
  for (const key of ['1x00000000000000000000AA','2x00000000000000000000AB','3x00000000000000000000FF']) {
    expect(() => turnstileSitekey(url, key)).toThrow();
  }
  expect(turnstileSitekey(url, '  production-sitekey  ')).toBe('production-sitekey');
});
