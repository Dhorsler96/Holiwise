import { defineConfig } from 'sanity';
import { structureTool } from 'sanity/structure';
import { visionTool } from '@sanity/vision';
import { schemaTypes } from './schemaTypes';

// Home page and site settings are singletons: one document each, no "create new".
const singletons = ['homePage', 'siteSettings'];

export default defineConfig({
  name: 'holiwise',
  title: 'Holiwise',
  projectId: process.env.SANITY_STUDIO_PROJECT_ID!,
  dataset: process.env.SANITY_STUDIO_DATASET || 'production',
  plugins: [
    structureTool({
      structure: (S) =>
        S.list().title('Content').items([
          S.listItem().title('Home page').id('homePage').child(S.document().schemaType('homePage').documentId('homePage')),
          S.listItem().title('Site settings').id('siteSettings').child(S.document().schemaType('siteSettings').documentId('siteSettings')),
          S.divider(),
          S.documentTypeListItem('destination').title('Destinations'),
        ]),
    }),
    visionTool(),
  ],
  schema: {
    types: schemaTypes,
    templates: (templates) => templates.filter((t) => !singletons.includes(t.schemaType)),
  },
  document: {
    actions: (actions, { schemaType }) =>
      singletons.includes(schemaType) ? actions.filter((a) => a.action && ['publish', 'discardChanges', 'restore'].includes(a.action)) : actions,
  },
});
