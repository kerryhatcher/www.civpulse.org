// @ts-check
import { defineConfig } from 'astro/config';

import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://www.civpulse.org',
  integrations: [
    sitemap({
      filter: (page) =>
        !['/admin/', '/account/', '/signin/', '/signup/', '/maps/view/', '/404'].some((path) =>
          page.includes(path),
        ),
    }),
  ],
});
