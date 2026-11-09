import { defineArrayMember, defineField, defineType } from 'sanity';
import { CogIcon } from '@sanity/icons/Cog';
import { linkFields } from './shared';

const link = (name = 'link') => defineArrayMember({ type: 'object', name, fields: linkFields, preview: { select: { title: 'label', subtitle: 'href' } } });

export const siteSettings = defineType({
  name: 'siteSettings',
  type: 'document',
  icon: CogIcon,
  fields: [
    defineField({ name: 'nav', type: 'array', title: 'Navigation', of: [link()] }),
    defineField({ name: 'inviteLabel', type: 'string', title: 'Invite link label' }),
    defineField({ name: 'agentLabel', type: 'string', title: 'Agent button label' }),
    defineField({ name: 'agentHref', type: 'url', title: 'Agent button link', description: 'Usually the WhatsApp link.', validation: (rule) => rule.uri({ scheme: ['https', 'tel', 'mailto'] }) }),
    defineField({ name: 'phone', type: 'string' }),
    defineField({ name: 'tagline', type: 'string' }),
    defineField({ name: 'footerHeadline', type: 'text', rows: 2 }),
    defineField({ name: 'socials', type: 'array', of: [link('social')] }),
    defineField({
      name: 'footerColumns', type: 'array',
      of: [defineArrayMember({ type: 'object', name: 'column', fields: [
        defineField({ name: 'title', type: 'string', validation: (rule) => rule.required() }),
        defineField({ name: 'links', type: 'array', of: [link()] }),
      ] })],
    }),
    defineField({ name: 'companyLine', type: 'string', title: 'Company details line' }),
    defineField({ name: 'abtaNumber', type: 'string', title: 'ABTA number' }),
    defineField({ name: 'iataLicence', type: 'string', title: 'IATA licence' }),
  ],
  preview: { prepare: () => ({ title: 'Site settings' }) },
});
