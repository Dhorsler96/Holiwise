import { defineArrayMember, defineField, defineType } from 'sanity';
import { HomeIcon } from '@sanity/icons/Home';
import { imageField } from './shared';

export const homePage = defineType({
  name: 'homePage',
  type: 'document',
  icon: HomeIcon,
  groups: [
    { name: 'hero', title: 'Hero', default: true },
    { name: 'story', title: 'How it works' },
    { name: 'ideas', title: 'Where next' },
    { name: 'value', title: 'Value' },
    { name: 'closing', title: 'Closing' },
  ],
  fields: [
    defineField({
      name: 'hero', type: 'object', group: 'hero',
      fields: [
        defineField({ name: 'headline', type: 'string', validation: (rule) => rule.required().max(40) }),
        defineField({ name: 'intro', type: 'text', rows: 3, validation: (rule) => rule.required().max(180) }),
        imageField('poster', 'Shown while the film loads, and instead of it for people who prefer reduced motion.'),
        defineField({ name: 'video', type: 'file', title: 'Background film', description: 'Optional. Short, silent MP4 loop under 8MB.', options: { accept: 'video/mp4' } }),
        defineField({ name: 'helper', type: 'string', title: 'Line under the search' }),
        defineField({ name: 'tellUsExamples', type: 'array', title: '“Just tell us” examples', description: 'Rotating example requests in the search bar.', of: [defineArrayMember({ type: 'string' })], validation: (rule) => rule.min(1).max(6) }),
      ],
    }),
    defineField({ name: 'statement', type: 'text', rows: 3, group: 'story', description: 'The large line on the green band.' }),
    defineField({
      name: 'howItWorks', type: 'object', group: 'story',
      fields: [
        defineField({ name: 'heading', type: 'string' }),
        defineField({
          name: 'steps', type: 'array', validation: (rule) => rule.length(3),
          of: [defineArrayMember({
            type: 'object', name: 'step',
            fields: [
              defineField({ name: 'title', type: 'string', validation: (rule) => rule.required() }),
              defineField({ name: 'description', type: 'text', rows: 2 }),
              defineField({
                name: 'illustration', type: 'string', description: 'Which animated illustration sits under this step.',
                options: { layout: 'radio', list: [
                  { title: 'Conversation with an agent', value: 'tellUs' },
                  { title: 'Three options', value: 'threeOptions' },
                  { title: 'Booking confirmed and looked after', value: 'booked' },
                ] },
                validation: (rule) => rule.required(),
              }),
            ],
          })],
        }),
      ],
    }),
    defineField({
      name: 'whereNext', type: 'object', group: 'ideas',
      fields: [
        defineField({ name: 'heading', type: 'string' }),
        defineField({ name: 'intro', type: 'text', rows: 2 }),
        defineField({ name: 'ctaLabel', type: 'string', title: 'Button label' }),
        defineField({ name: 'destinations', type: 'array', of: [defineArrayMember({ type: 'reference', to: [{ type: 'destination' }] })], validation: (rule) => rule.min(2).max(8).unique() }),
      ],
    }),
    defineField({
      name: 'favourites', type: 'object', group: 'ideas', title: 'Some of our favourites',
      fields: [
        defineField({ name: 'heading', type: 'string' }),
        defineField({ name: 'intro', type: 'text', rows: 2 }),
        defineField({
          name: 'stays', type: 'array', validation: (rule) => rule.max(9),
          of: [defineArrayMember({ type: 'object', name: 'favouriteStay', fields: [
            defineField({ name: 'place', type: 'string', title: 'Country or region' }),
            defineField({ name: 'title', type: 'string', title: 'Stay', validation: (rule) => rule.required() }),
            defineField({ name: 'details', type: 'string', description: 'e.g. 6 nights, 2 guests from' }),
            defineField({ name: 'summary', type: 'text', rows: 2 }),
            defineField({ name: 'price', type: 'string', description: 'Shown after "From", e.g. £5,573' }),
            imageField('image'),
          ], preview: { select: { title: 'title', subtitle: 'place', media: 'image' } } })],
        }),
      ],
    }),
    defineField({
      name: 'deal', type: 'object', group: 'value', title: 'Best overall deal',
      fields: [
        defineField({ name: 'heading', type: 'string' }),
        defineField({ name: 'body', type: 'text', rows: 2 }),
        defineField({ name: 'reassurance', type: 'string' }),
        defineField({ name: 'stayTitle', type: 'string', title: 'Example stay' }),
        defineField({ name: 'eyebrow', type: 'string', title: 'Label above the benefits' }),
        defineField({
          name: 'benefits', type: 'array',
          of: [defineArrayMember({ type: 'object', name: 'benefit', fields: [
            defineField({ name: 'label', type: 'string', validation: (rule) => rule.required() }),
            defineField({ name: 'value', type: 'string', title: 'Detail' }),
          ], preview: { select: { title: 'label', subtitle: 'value' } } })],
        }),
        defineField({ name: 'priceLabel', type: 'string' }),
        defineField({ name: 'price', type: 'string' }),
      ],
    }),
    defineField({
      name: 'finalCta', type: 'object', group: 'closing', title: 'Closing call to action',
      fields: [
        defineField({ name: 'headline', type: 'text', rows: 2, description: 'Use a line break to split the headline.' }),
        imageField('image'),
        defineField({ name: 'primaryLabel', type: 'string', title: 'Main button' }),
        defineField({ name: 'secondaryLabel', type: 'string', title: 'Second button' }),
      ],
    }),
  ],
  preview: { prepare: () => ({ title: 'Home page' }) },
});
