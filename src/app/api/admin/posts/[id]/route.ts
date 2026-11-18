// GET    /api/admin/posts/{id} – full post incl. claims (with proofs) for review.
// DELETE /api/admin/posts/{id} – permanent delete (super admin only; claims and chats go too).
import { NextRequest, NextResponse } from 'next/server';
import { adminFail, adminRouteError, audit, requireAdmin } from '@/lib/admin/server';
import { getPost } from '@/lib/admin/data';
import { deleteItem, listClaimsForItem } from '@/lib/db';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const auth = await requireAdmin(req, 'posts.view');
  if (auth.response) return auth.response;
  try {
    const { id } = await params;
    const post = await getPost(id);
    if (!post) return adminFail(404, 'Post not found.');
    const claims = await listClaimsForItem(id);
    return NextResponse.json({ success: true, data: { post, claims } });
  } catch (e) {
    return adminRouteError(e, 'posts/[id] GET');
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const auth = await requireAdmin(req, 'posts.delete');
  if (auth.response) return auth.response;
  try {
    const { id } = await params;
    const post = await getPost(id);
    if (!post) return adminFail(404, 'Post not found.');
    await deleteItem(id);
    await audit(auth.admin, 'post.delete', { type: 'item', id }, { title: post.title, poster: post.poster.email ?? post.poster.id, city: post.location.city }, req);
    return NextResponse.json({ success: true });
  } catch (e) {
    return adminRouteError(e, 'posts/[id] DELETE');
  }
}
