import type { Metadata } from 'next';
import { requirePagePermission } from '@/lib/admin/server';
import AdsSettingsView from '@/components/admin/AdsSettingsView';

export const metadata: Metadata = { title: 'Ads settings' };

export default async function AdminAdsPage() {
  await requirePagePermission('ads.manage');
  return <AdsSettingsView />;
}
