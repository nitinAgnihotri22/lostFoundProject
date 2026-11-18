import type { Metadata } from 'next';
import { requirePagePermission } from '@/lib/admin/server';
import MessagesView from '@/components/admin/MessagesView';

export const metadata: Metadata = { title: 'Contact messages' };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminMessagesPage({ searchParams }: { searchParams: SP }) {
  await requirePagePermission('messages.view');
  const { status } = await searchParams;
  return <MessagesView initial={{ status: typeof status === 'string' ? status : undefined }} />;
}
