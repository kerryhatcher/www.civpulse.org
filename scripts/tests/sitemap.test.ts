import { expect, test } from 'bun:test';
import { includeInSitemap } from '../../apps/web/astro.config.mjs';
import { shouldNoIndex } from '../../apps/web/src/lib/indexing-policy.mjs';

const origin = 'https://www.civpulse.org';
test('public UUID pages beginning with 404 remain discoverable', () => {
  for (const path of [
    '/records/bills/4043ede2-4165-5773-84cf-be08f89a8e8a/',
    '/records/bills/4049c884-5feb-5988-9a33-2a0a503afee4/',
    '/records/events/404c4993-db6c-473e-9c90-5a90156521ee/',
    '/people/404-example/', '/', '/records/', '/about/', '/docs/users/',
    '/counties/bibb/', '/calendar/', '/documents/', '/elections/results/',
    '/finances/', '/statistics/', '/legislation/sessions/', '/people/', '/orgs/',
    '/maps/', '/elections/', '/requests/', '/searchable/', '/administer/',
  ]) expect(includeInSitemap(origin + path)).toBe(true);
});
test('error pages, protected shells and data assets remain excluded', () => {
  for (const path of [
    '/404', '/404/', '/404.html', '/admin/people/', '/account/',
    '/signin/', '/signup/', '/oauth/consent/', '/requests/view/', '/search/', '/history/',
    '/legislation/view/', '/legislation/vote/', '/legislation/session/',
    '/maps/view/', '/calendar/view/', '/people/view/', '/elections/view/',
    '/map-data/maps/example.json', '/profile-data/example.json', '/directory-data/example.json', '/county-data.json',
  ]) expect(includeInSitemap(origin + path)).toBe(false);
});

test('utility HTML and sitemap policy agree, with exact route boundaries', () => {
  for (const path of ['/admin', '/admin/people', '/oauth/consent', '/signin', '/signup',
    '/account', '/search', '/history', '/requests/view', '/legislation/view',
    '/legislation/vote', '/legislation/session', '/maps/view', '/calendar/view',
    '/people/view', '/elections/view', '/404', '/404.html']) {
    for (const suffix of ['', '/']) {
      expect(shouldNoIndex(path + suffix)).toBe(true);
      expect(includeInSitemap(`${origin}${path}${suffix}?id=example&q=query`)).toBe(false);
    }
  }
  for (const path of ['/people/view-example/', '/maps/view-of-bibb/', '/records/events/404-example/', '/administer/', '/searchable/']) {
    expect(shouldNoIndex(path)).toBe(false);
    expect(includeInSitemap(origin + path)).toBe(true);
  }
});
