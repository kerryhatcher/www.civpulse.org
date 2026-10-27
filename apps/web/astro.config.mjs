// @ts-check
import { defineConfig } from 'astro/config';

import sitemap from '@astrojs/sitemap';

/** @param {string} page */
export function includeInSitemap(page) {
  const pathname = new URL(page).pathname;
  return !/^\/404(?:\/|\.html)?$/.test(pathname) && ![
    '/admin/',
    '/account/',
    '/signin/',
    '/signup/',
    '/requests/view/',
    '/legislation/view/',
    '/legislation/vote/',
    '/legislation/session/',
    '/maps/view/',
    '/map-data/',
    '/profile-data/',
    '/directory-data/',
    '/calendar-data/',
    '/calendar/view/',
    '/people/view/',
    '/elections/view/',
    '/oauth/',
  ].some((path) => pathname.includes(path));
}

// https://astro.build/config
export default defineConfig({
  site: 'https://www.civpulse.org',
  integrations: [sitemap({ filter: includeInSitemap })],
});
