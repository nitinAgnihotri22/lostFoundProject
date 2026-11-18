import type { Metadata } from 'next';
import { requirePagePermission } from '@/lib/admin/server';
import PagesView from '@/components/admin/PagesView';

export const metadata: Metadata = { title: 'Pages & company details' };

export default async function AdminPagesPage() {
  await requirePagePermission('pages.manage');
  return <PagesView />;
}
