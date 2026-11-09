# Holiwise homepage (Astro + Sanity)

Built from the Figma frame "Home" (553_Holiwise_Week-01, node 218:1395).

## Run it

```bash
npm install
npm run dev
```

Without Sanity credentials the site renders from `src/content/seed.json`, so it works straight away.

## Connect Sanity

1. Copy `.env.example` to `.env` and set `PUBLIC_SANITY_PROJECT_ID` (and dataset).
2. Start the Studio: `cd studio && npm install && SANITY_STUDIO_PROJECT_ID=<id> npm run dev`.
3. Load the starting content: `PUBLIC_SANITY_PROJECT_ID=<id> SANITY_WRITE_TOKEN=<token> npm run seed`.
4. Add the site's URL to the project's CORS origins if you fetch from the browser (the site itself only fetches at build time).

Content model: `homePage` (singleton), `siteSettings` (singleton), `destination`. Every field falls back to the seed value if left empty.

## Where things are

- `src/pages/index.astro`: the page
- `src/components/*`: one component per section
- `src/styles/global.css`: tokens and all styles, including motion rules
- `src/scripts/main.ts`: interactions (search, tabs, carousel, reveals, nav, parallax)
- `src/lib/sanity.ts`: GROQ queries and the seed fallback
- `studio/`: Sanity Studio and schema
- `scripts/seed.mjs`: loads the seed content into Sanity

## Before launch

- Fonts in `public/fonts` are TRIAL files. Replace with licensed web fonts. The wordmark uses Outfit as a stand-in for KH Hekto.
- Hero and "Where next" images are placeholders taken from the design file and the current site.
- The search form is front-end only: submitting shows a confirmation but sends nothing.
