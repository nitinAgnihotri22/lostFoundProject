import type { Metadata } from 'next';
import { requirePagePermission } from '@/lib/admin/server';
import AdminsView from '@/components/admin/AdminsView';

export const metadata: Metadata = { title: 'Admin users' };

export default async function AdminAdminsPage() {
  await requirePagePermission('admins.manage');
  return <AdminsView />;
}
