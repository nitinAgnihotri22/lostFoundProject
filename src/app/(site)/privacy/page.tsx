import type { Metadata } from 'next';
import ContentPage, { DocView } from '@/components/ContentPage';
import Markdown from '@/components/Markdown';
import { getServerT } from '@/i18n/server';
import { privacyPolicy } from '@/content/privacy';
import { parseMarkdown, markdownToc } from '@/lib/markdown';
import { getPageOverride, getSiteConfig, isoDay } from '@/lib/siteContent';

export async function generateMetadata(): Promise<Metadata> {
  const { lang, t } = await getServerT();
  const custom = await getPageOverride('privacy', lang);
  return { title: custom?.title || t('pages.privacyTitle'), description: t('pages.privacyDesc'), alternates: { canonical: '/privacy' } };
}

export default async function PrivacyPage() {
  const { lang, t } = await getServerT();
  const [{ config, customized }, custom] = await Promise.all([getSiteConfig(), getPageOverride('privacy', lang)]);

  // Text published from /admin/pages replaces the built-in policy.
  if (custom) {
    const blocks = parseMarkdown(custom.body);
    return (
      <ContentPage title={custom.title || t('pages.privacyTitle')} description={t('pages.privacyDesc')} lastUpdated={isoDay(custom.updatedAt)} toc={markdownToc(blocks)}>
        <Markdown blocks={blocks} />
      </ContentPage>
    );
  }
  const doc = privacyPolicy(lang, config);
  return (
    <ContentPage title={t('pages.privacyTitle')} description={t('pages.privacyDesc')} lastUpdated={config.legalLastUpdated} toc={doc.sections} mockNotice={!customized}>
      <DocView doc={doc} />
    </ContentPage>
  );
}
