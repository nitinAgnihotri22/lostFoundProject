import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAdminFromCookies } from '@/lib/admin/server';
import AdminLoginForm from '@/components/admin/AdminLoginForm';

export const metadata: Metadata = { title: 'Sign in' };

export default async function AdminLoginPage() {
  // Already signed in to the admin panel → straight to the dashboard.
  if (await getAdminFromCookies().catch(() => null)) redirect('/admin');
  return <AdminLoginForm />;
}
