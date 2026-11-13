import { createClient, type SanityClient } from '@sanity/client';
import imageUrlBuilder from '@sanity/image-url';
import { defineQuery } from 'groq';
import seed from '../content/seed.json';

export type Img = { src: string; alt: string; lqip?: string };
export type SiteContent = typeof seed;

const projectId = import.meta.env.PUBLIC_SANITY_PROJECT_ID;
const dataset = import.meta.env.PUBLIC_SANITY_DATASET || 'production';

export const sanityEnabled = Boolean(projectId);

const client: SanityClient | null = projectId
  ? createClient({ projectId, dataset, apiVersion: '2026-11-01', useCdn: false })
  : null;

const builder = client ? imageUrlBuilder(client) : null;

const imageFragment = /* groq */ `
  asset->{ _id, url, metadata { lqip, dimensions { width, height } } },
  alt, hotspot, crop
`;

export const HOME_QUERY = defineQuery(/* groq */ `
  *[_type == "homePage"][0]{
    hero{
      headline, intro, helper, tellUsExamples,
      "videoUrl": video.asset->url,
      poster{ ${imageFragment} }
    },
    statement,
    howItWorks{ heading, steps[]{ _key, title, description, illustration } },
    whereNext{
      heading, intro, ctaLabel,
      destinations[]->{ _id, title, "slug": slug.current, summary, "video": video.asset->url, image{ ${imageFragment} } }
    },
    favourites{ heading, intro, stays[]{ _key, place, title, details, summary, price, image{ ${imageFragment} } } },
    deal{ heading, body, reassurance, ctaLabel, ctaHref, ctaNote, cardTitle, badge, eyebrow, benefits[]{ _key, label, value }, inviteLabel, inviteLinkLabel, inviteLinkHref },
    finalCta{ headline, primaryLabel, secondaryLabel, image{ ${imageFragment} } }
  }
`);

export const SETTINGS_QUERY = defineQuery(/* groq */ `
  *[_type == "siteSettings"][0]{
    nav[]{ _key, label, href },
    inviteLabel, agentLabel, agentHref, phone, tagline, footerHeadline,
    socials[]{ _key, label, href },
    footerColumns[]{ _key, title, links[]{ _key, label, href } },
    companyLine, abtaNumber, iataLicence
  }
`);

/** Turn a Sanity image into a plain { src, alt, lqip }, sized for where it is used. */
function toImg(image: any, width: number, fallback: Img): Img {
  if (!image?.asset || !builder) return fallback;
  return {
    src: builder.image(image).width(width).auto('format').quality(80).url(),
    alt: image.alt || fallback.alt,
    lqip: image.asset.metadata?.lqip,
  };
}

/** Shallow-merge CMS values over the seed so a half-filled document never breaks the page. */
function over<T extends Record<string, any>>(base: T, patch: Record<string, any> | null | undefined): T {
  if (!patch) return base;
  const out: Record<string, any> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value !== null && value !== undefined && !(Array.isArray(value) && value.length === 0)) out[key] = value;
  }
  return out as T;
}

export async function getSiteContent(): Promise<SiteContent> {
  if (!client) return seed;
  try {
    const [home, settings] = await Promise.all([client.fetch(HOME_QUERY), client.fetch(SETTINGS_QUERY)]);
    if (!home) return seed;
    const s = seed.home;
    return {
      settings: over(seed.settings, settings),
      premium: seed.premium,
      about: seed.about,
      home: {
        hero: {
          ...over(s.hero, home.hero),
          poster: toImg(home.hero?.poster, 2400, s.hero.poster),
          videoUrl: home.hero?.videoUrl ?? s.hero.videoUrl,
        },
        statement: home.statement || s.statement,
        howItWorks: over(s.howItWorks, home.howItWorks),
        whereNext: {
          ...over(s.whereNext, home.whereNext),
          destinations: home.whereNext?.destinations?.length
            ? home.whereNext.destinations.map((d: any, i: number) => ({
                title: d.title,
                slug: d.slug,
                summary: d.summary,
                video: d.video ?? undefined,
                image: toImg(d.image, 2000, s.whereNext.destinations[i % s.whereNext.destinations.length].image),
              }))
            : s.whereNext.destinations,
        },
        favourites: {
          ...over(s.favourites, home.favourites),
          stays: home.favourites?.stays?.length
            ? home.favourites.stays.map((f: any, i: number) => ({
                ...over(s.favourites.stays[i % s.favourites.stays.length], f),
                image: toImg(f.image, 1200, s.favourites.stays[i % s.favourites.stays.length].image),
              }))
            : s.favourites.stays,
        },
        deal: over(s.deal, home.deal),
        finalCta: { ...over(s.finalCta, home.finalCta), image: toImg(home.finalCta?.image, 2400, s.finalCta.image) },
      },
    } as SiteContent;
  } catch (error) {
    console.warn('[sanity] Falling back to seed content:', (error as Error).message);
    return seed;
  }
}
