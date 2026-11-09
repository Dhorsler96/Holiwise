import { defineField } from 'sanity';

/** Image with hotspot and required alt text. */
export const imageField = (name: string, description?: string) =>
  defineField({
    name,
    type: 'image',
    description,
    options: { hotspot: true },
    fields: [
      defineField({
        name: 'alt',
        type: 'string',
        title: 'Alternative text',
        description: 'Describe the image for people who cannot see it.',
        validation: (rule) => rule.required().warning('Alt text matters for accessibility and SEO'),
      }),
    ],
  });

export const linkFields = [
  defineField({ name: 'label', type: 'string', validation: (rule) => rule.required() }),
  defineField({ name: 'href', type: 'string', title: 'Link', description: 'A URL, or an on-page anchor such as #where-next', validation: (rule) => rule.required() }),
];
