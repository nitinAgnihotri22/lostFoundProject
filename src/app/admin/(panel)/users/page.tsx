import type { Metadata } from 'next';
import { requirePagePermission } from '@/lib/admin/server';
import UsersView from '@/components/admin/UsersView';

export const metadata: Metadata = { title: 'Website users' };

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function AdminUsersPage({ searchParams }: { searchParams: SP }) {
  await requirePagePermission('users.view');
  const sp = await searchParams;
  return <UsersView initial={{ search: one(sp.search), status: one(sp.status), create: one(sp.create) === '1' }} />;
}
