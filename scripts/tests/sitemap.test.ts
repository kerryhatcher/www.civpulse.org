import { expect, test } from 'bun:test';
import { includeInSitemap } from '../../apps/web/astro.config.mjs';

const origin = 'https://www.civpulse.org';
test('public UUID pages beginning with 404 remain discoverable', () => {
  for (const path of [
    '/records/bills/4043ede2-4165-5773-84cf-be08f89a8e8a/',
    '/records/bills/4049c884-5feb-5988-9a33-2a0a503afee4/',
    '/records/events/404c4993-db6c-473e-9c90-5a90156521ee/',
    '/people/404-example/', '/', '/records/',
  ]) expect(includeInSitemap(origin + path)).toBe(true);
});
test('error pages, protected shells and data assets remain excluded', () => {
  for (const path of [
    '/404', '/404/', '/404.html', '/admin/people/', '/account/',
    '/signin/', '/signup/', '/oauth/consent/', '/requests/view/',
    '/legislation/view/', '/legislation/vote/', '/legislation/session/',
    '/maps/view/', '/calendar/view/', '/people/view/', '/elections/view/',
    '/map-data/maps/example.json', '/profile-data/example.json', '/directory-data/example.json', '/county-data.json',
  ]) expect(includeInSitemap(origin + path)).toBe(false);
});
