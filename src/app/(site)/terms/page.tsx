import type { Metadata } from 'next';
import ContentPage, { DocView } from '@/components/ContentPage';
import Markdown from '@/components/Markdown';
import { getServerT } from '@/i18n/server';
import { termsOfService } from '@/content/terms';
import { parseMarkdown, markdownToc } from '@/lib/markdown';
import { getPageOverride, getSiteConfig, isoDay } from '@/lib/siteContent';

export async function generateMetadata(): Promise<Metadata> {
  const { lang, t } = await getServerT();
  const custom = await getPageOverride('terms', lang);
  return { title: custom?.title || t('pages.termsTitle'), description: t('pages.termsDesc'), alternates: { canonical: '/terms' } };
}

export default async function TermsPage() {
  const { lang, t } = await getServerT();
  const [{ config, customized }, custom] = await Promise.all([getSiteConfig(), getPageOverride('terms', lang)]);

  // Text published from /admin/pages replaces the built-in policy.
  if (custom) {
    const blocks = parseMarkdown(custom.body);
    return (
      <ContentPage title={custom.title || t('pages.termsTitle')} description={t('pages.termsDesc')} lastUpdated={isoDay(custom.updatedAt)} toc={markdownToc(blocks)}>
        <Markdown blocks={blocks} />
      </ContentPage>
    );
  }
  const doc = termsOfService(lang, config);
  return (
    <ContentPage title={t('pages.termsTitle')} description={t('pages.termsDesc')} lastUpdated={config.legalLastUpdated} toc={doc.sections} mockNotice={!customized}>
      <DocView doc={doc} />
    </ContentPage>
  );
}
