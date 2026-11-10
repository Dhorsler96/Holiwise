import { defineField, defineType } from 'sanity';
import { PinIcon } from '@sanity/icons/Pin';
import { imageField } from './shared';

export const destination = defineType({
  name: 'destination',
  type: 'document',
  icon: PinIcon,
  fields: [
    defineField({ name: 'title', type: 'string', validation: (rule) => rule.required() }),
    defineField({ name: 'slug', type: 'slug', options: { source: 'title' }, validation: (rule) => rule.required() }),
    defineField({ name: 'summary', type: 'text', rows: 3, description: 'Two sentences. A starting point, not a package.', validation: (rule) => rule.required().max(220) }),
    imageField('image', 'Landscape, at least 2200px wide. Quiet luxury: landscapes, light and service.'),
    defineField({ name: 'video', type: 'file', options: { accept: 'video/mp4' }, description: 'Optional short loop (MP4, H.264, no audio, under 5MB). Plays in the Where next card; the image is its still.' }),
  ],
  preview: { select: { title: 'title', media: 'image' } },
});
