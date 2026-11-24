import type { Metadata } from 'next';
import AlertsView from '@/components/AlertsView';
import { getServerT } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerT();
  // Personal page: keep it out of search results.
  return { title: t('alerts.pageTitle'), description: t('alerts.pageDesc'), robots: { index: false, follow: false } };
}

export default function AlertsPage() {
  return <AlertsView />;
}
