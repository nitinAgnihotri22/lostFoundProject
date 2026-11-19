import type { Metadata } from 'next';
import { requirePagePermission } from '@/lib/admin/server';
import ReviewView from '@/components/admin/ReviewView';

export const metadata: Metadata = { title: 'Review queue' };

export default async function AdminReviewPage() {
  await requirePagePermission('posts.review');
  return <ReviewView />;
}
