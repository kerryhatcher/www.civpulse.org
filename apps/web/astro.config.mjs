// @ts-check
import { defineConfig } from 'astro/config';

import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://www.civpulse.org',
  integrations: [
    sitemap({
      filter: (page) =>
        ![
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
          '/calendar/view/',
          '/people/view/',
          '/elections/view/',
          '/oauth/',
          '/404',
        ].some((path) => page.includes(path)),
    }),
  ],
});
