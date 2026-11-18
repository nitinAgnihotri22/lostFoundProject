// Every /admin page except /admin/login: requires an admin session (lf_admin cookie).
// A website session (lf_token) is ignored here.
import { redirect } from 'next/navigation';
import { getAdminFromCookies, toAdminProfile } from '@/lib/admin/server';
import AdminShell from '@/components/admin/AdminShell';

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdminFromCookies().catch(() => null);
  if (!admin) redirect('/admin/login');
  return <AdminShell admin={toAdminProfile(admin)}>{children}</AdminShell>;
}
