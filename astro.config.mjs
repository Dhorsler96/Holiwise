import { defineConfig } from 'astro/config';

// Sanity is read at build time through src/lib/sanity.ts.
// Set PUBLIC_SANITY_PROJECT_ID / PUBLIC_SANITY_DATASET in .env to switch from the bundled seed content to live content.
export default defineConfig({
  site: 'https://www.holiwise.com',
  devToolbar: { enabled: false },
});
