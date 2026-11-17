import type { Metadata } from 'next';
import ContentPage, { DocView } from '@/components/ContentPage';
import { getServerT } from '@/i18n/server';
import { accessibilityStatement } from '@/content/about';
import { siteConfig } from '@/lib/siteConfig';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerT();
  return { title: t('pages.accessibilityTitle'), description: t('pages.accessibilityDesc'), alternates: { canonical: '/accessibility' } };
}

export default async function AccessibilityPage() {
  const { lang, t } = await getServerT();
  const doc = accessibilityStatement(lang);
  return (
    <ContentPage title={t('pages.accessibilityTitle')} description={t('pages.accessibilityDesc')} lastUpdated={siteConfig.legalLastUpdated} toc={doc.sections}>
      <DocView doc={doc} />
    </ContentPage>
  );
}
