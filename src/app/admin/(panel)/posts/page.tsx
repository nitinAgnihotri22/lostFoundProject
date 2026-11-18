import type { Metadata } from 'next';
import { requirePagePermission } from '@/lib/admin/server';
import PostsView from '@/components/admin/PostsView';

export const metadata: Metadata = { title: 'Posts' };

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function AdminPostsPage({ searchParams }: { searchParams: SP }) {
  await requirePagePermission('posts.view');
  const sp = await searchParams;
  return (
    <PostsView
      initial={{ search: one(sp.search), city: one(sp.city), type: one(sp.type), status: one(sp.status), visibility: one(sp.visibility), userId: one(sp.userId) }}
    />
  );
}
