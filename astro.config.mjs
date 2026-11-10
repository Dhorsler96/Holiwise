import { defineConfig } from 'astro/config';

// Sanity is read at build time through src/lib/sanity.ts.
// Set PUBLIC_SANITY_PROJECT_ID / PUBLIC_SANITY_DATASET in .env to switch from the bundled seed content to live content.
export default defineConfig({
  site: 'https://www.holiwise.com',
  devToolbar: { enabled: false },
  // Keep -webkit-backdrop-filter in the minified CSS: Safari before 18 only understands the prefixed form,
  // and without it every glass surface (search, buttons, nav, popovers) renders unblurred there.
  vite: { build: { cssTarget: ['chrome100', 'edge100', 'firefox100', 'safari15', 'ios15'] } },
});
