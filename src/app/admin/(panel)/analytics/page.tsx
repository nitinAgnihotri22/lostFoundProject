import type { Metadata } from 'next';
import { requirePagePermission } from '@/lib/admin/server';
import AnalyticsView from '@/components/admin/AnalyticsView';

export const metadata: Metadata = { title: 'Analytics' };

export default async function AdminAnalyticsPage() {
  await requirePagePermission('analytics.view');
  return <AnalyticsView />;
}
