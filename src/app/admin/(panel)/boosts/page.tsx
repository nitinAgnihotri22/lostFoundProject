import type { Metadata } from 'next';
import { requirePagePermission } from '@/lib/admin/server';
import BoostsView from '@/components/admin/BoostsView';

export const metadata: Metadata = { title: 'Boosts' };

export default async function AdminBoostsPage() {
  await requirePagePermission('boosts.view');
  return <BoostsView />;
}
