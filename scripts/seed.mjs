// Loads src/content/seed.json (and its images) into Sanity as drafts-free published documents.
// Usage: PUBLIC_SANITY_PROJECT_ID=xxx SANITY_WRITE_TOKEN=xxx npm run seed
import { createClient } from '@sanity/client';
import { createReadStream, readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

const projectId = process.env.PUBLIC_SANITY_PROJECT_ID;
const token = process.env.SANITY_WRITE_TOKEN;
const dataset = process.env.PUBLIC_SANITY_DATASET || 'production';
if (!projectId || !token) { console.error('Set PUBLIC_SANITY_PROJECT_ID and SANITY_WRITE_TOKEN first.'); process.exit(1); }

const client = createClient({ projectId, dataset, token, apiVersion: '2026-11-01', useCdn: false });
const seed = JSON.parse(readFileSync(new URL('../src/content/seed.json', import.meta.url), 'utf8'));
const key = () => randomUUID().slice(0, 12);
const keyed = (items) => items.map((item) => ({ _key: key(), ...item }));

async function image({ src, alt }) {
  const file = path.join(process.cwd(), 'public', src);
  const asset = await client.assets.upload('image', createReadStream(file), { filename: path.basename(file) });
  return { _type: 'image', alt, asset: { _type: 'reference', _ref: asset._id } };
}

const { home, settings } = seed;

// Destinations: find by slug so re-running updates instead of duplicating.
const refs = [];
for (const d of home.whereNext.destinations) {
  const existing = await client.fetch('*[_type == "destination" && slug.current == $slug][0]{_id}', { slug: d.slug });
  const doc = { _type: 'destination', title: d.title, slug: { _type: 'slug', current: d.slug }, summary: d.summary, image: await image(d.image) };
  const saved = existing ? await client.patch(existing._id).set(doc).commit() : await client.create(doc);
  refs.push({ _key: key(), _type: 'reference', _ref: saved._id });
  console.log('destination', d.title);
}

await client.createOrReplace({
  _id: 'homePage', _type: 'homePage',
  hero: { headline: home.hero.headline, intro: home.hero.intro, helper: home.hero.helper, tellUsExamples: home.hero.tellUsExamples, poster: await image(home.hero.poster) },
  statement: home.statement,
  howItWorks: { heading: home.howItWorks.heading, steps: keyed(home.howItWorks.steps.map((s) => ({ _type: 'step', ...s }))) },
  whereNext: { heading: home.whereNext.heading, intro: home.whereNext.intro, ctaLabel: home.whereNext.ctaLabel, destinations: refs },
  deal: { ...home.deal, benefits: keyed(home.deal.benefits.map((b) => ({ _type: 'benefit', ...b }))) },
  finalCta: { headline: home.finalCta.headline, primaryLabel: home.finalCta.primaryLabel, secondaryLabel: home.finalCta.secondaryLabel, image: await image(home.finalCta.image) },
});
console.log('homePage');

await client.createOrReplace({
  _id: 'siteSettings', _type: 'siteSettings', ...settings,
  nav: keyed(settings.nav.map((l) => ({ _type: 'link', ...l }))),
  socials: keyed(settings.socials.map((l) => ({ _type: 'social', ...l }))),
  footerColumns: keyed(settings.footerColumns.map((c) => ({ _type: 'column', title: c.title, links: keyed(c.links.map((l) => ({ _type: 'link', ...l }))) }))),
});
console.log('siteSettings\nDone.');
