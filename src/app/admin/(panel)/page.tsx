import type { Metadata } from 'next';
import { requirePagePermission } from '@/lib/admin/server';
import DashboardView from '@/components/admin/DashboardView';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function AdminDashboardPage() {
  await requirePagePermission('dashboard.view');
  return <DashboardView />;
}
