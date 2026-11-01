// @ts-check
import { defineConfig } from 'astro/config';

import sitemap from '@astrojs/sitemap';
import { shouldNoIndex } from './src/lib/indexing-policy.mjs';

/** @param {string} page */
export function includeInSitemap(page) {
  const pathname = new URL(page).pathname;
  return !shouldNoIndex(pathname) && ![
    '/map-data/',
    '/profile-data/',
    '/directory-data/',
    '/calendar-data/',
    '/county-data.json',
  ].some((path) => pathname.includes(path));
}

// https://astro.build/config
export default defineConfig({
  site: 'https://www.civpulse.org',
  integrations: [sitemap({ filter: includeInSitemap })],
});
