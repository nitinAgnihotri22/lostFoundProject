import type { Metadata } from 'next';
import ContentPage, { DocView } from '@/components/ContentPage';
import { getServerT } from '@/i18n/server';
import { termsOfService } from '@/content/terms';
import { siteConfig } from '@/lib/siteConfig';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerT();
  return { title: t('pages.termsTitle'), description: t('pages.termsDesc'), alternates: { canonical: '/terms' } };
}

export default async function TermsPage() {
  const { lang, t } = await getServerT();
  const doc = termsOfService(lang);
  return (
    <ContentPage title={t('pages.termsTitle')} description={t('pages.termsDesc')} lastUpdated={siteConfig.legalLastUpdated} toc={doc.sections} mockNotice>
      <DocView doc={doc} />
    </ContentPage>
  );
}
