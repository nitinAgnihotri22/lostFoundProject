// The built-in text of each editable page, as Markdown – the admin editor
// starts from this, and "Revert to default" goes back to it.
import type { Lang } from '@/i18n/config';
import { createT } from '@/i18n/translate';
import { privacyPolicy } from '@/content/privacy';
import { termsOfService } from '@/content/terms';
import { aboutContent } from '@/content/about';
import { docToMarkdown } from '@/lib/markdown';
import type { SiteSettings } from '@/lib/siteConfig';
import type { PageSlug } from '@/lib/siteContent';

export function defaultPageTitle(slug: PageSlug, lang: Lang): string {
  const t = createT(lang);
  return {
    privacy: t('pages.privacyTitle'),
    terms: t('pages.termsTitle'),
    about: t('pages.aboutTitle'),
    contact: t('pages.contactTitle'),
  }[slug];
}

export function defaultPageMarkdown(slug: PageSlug, lang: Lang, config: SiteSettings): string {
  switch (slug) {
    case 'privacy':
      return docToMarkdown(privacyPolicy(lang, config));
    case 'terms':
      return docToMarkdown(termsOfService(lang, config));
    case 'contact':
      return createT(lang)('contact.intro') + '\n';
    case 'about': {
      const a = aboutContent(lang, config);
      return [
        a.lead,
        `## ${a.stepsTitle}`,
        a.steps.map((s) => `- **${s.title}** – ${s.body}`).join('\n'),
        `## ${a.valuesTitle}`,
        a.values.map((v) => `- **${v.title}** – ${v.body}`).join('\n'),
        docToMarkdown(a.story).trim(),
      ].join('\n\n') + '\n';
    }
  }
}

/** What each page's editable text covers, shown above the editor. */
export const PAGE_HELP: Record<PageSlug, string> = {
  privacy: 'Replaces the whole Privacy Policy. Each "## Heading" becomes a section in the table of contents.',
  terms: 'Replaces the whole Terms and Conditions. Each "## Heading" becomes a section in the table of contents.',
  about: 'Replaces the About Us story, steps and values. The “Get in touch / Browse items” banner stays at the bottom.',
  contact: 'Shown above the contact form. Email, phone, address, hours and the Grievance Officer come from Company details.',
};
