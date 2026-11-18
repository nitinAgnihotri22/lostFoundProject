import type { Metadata } from 'next';
import { requirePagePermission } from '@/lib/admin/server';
import AuditView from '@/components/admin/AuditView';

export const metadata: Metadata = { title: 'Activity log' };

export default async function AdminAuditPage() {
  await requirePagePermission('audit.view');
  return <AuditView />;
}
