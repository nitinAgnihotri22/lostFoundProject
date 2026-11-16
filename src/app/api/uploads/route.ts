// POST /api/uploads – upload one item photo (multipart/form-data, field "file").
// Stores it in the public Supabase bucket and returns its URL for use in POST /api/items.
import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { uploadPhoto } from '@/lib/db';
import { fail, requireAuth } from '@/lib/session';
import { LIMITS } from '@/lib/validation';
import { routeError } from '@/lib/itemView';

const ALLOWED: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.response) return auth.response;

  try {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return fail(400, 'Send the photo as multipart/form-data with a "file" field.');
    }
    const file = form.get('file');
    if (!(file instanceof Blob)) return fail(400, 'Missing "file" field.');

    const ext = ALLOWED[file.type];
    if (!ext) return fail(415, 'Only JPEG, PNG, WebP or GIF images are accepted.');
    if (file.size === 0) return fail(400, 'The file is empty.');
    if (file.size > LIMITS.photoBytes) {
      return fail(413, `Photos must be ${Math.round(LIMITS.photoBytes / 1024 / 1024)} MB or smaller.`);
    }

    const path = `${auth.user.id}/${crypto.randomUUID()}.${ext}`;
    const url = await uploadPhoto(path, await file.arrayBuffer(), file.type);
    return NextResponse.json({ success: true, data: { url, path, size: file.size, contentType: file.type } }, { status: 201 });
  } catch (e) {
    return routeError(e, 'uploads POST');
  }
}
