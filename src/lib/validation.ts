// Input validation shared by the API routes.
import { Category, ItemType } from '@/types';

export const CATEGORIES: Category[] = [
  'electronics', 'wallets', 'keys', 'bags', 'documents', 'jewelry', 'pets', 'clothing', 'other',
];
export const ITEM_TYPES: ItemType[] = ['found', 'lost'];

export const LIMITS = {
  titleMin: 3,
  titleMax: 120,
  descriptionMin: 10,
  descriptionMax: 2000,
  maxImages: 6,
  questionMax: 200,
  proofMax: 500,
  messageMax: 2000,
  reasonMax: 300,
  photoBytes: 5 * 1024 * 1024,
} as const;

export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
  }
}

export const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

export function requireText(v: unknown, field: string, min: number, max: number): string {
  const s = str(v);
  if (s.length < min) throw new ValidationError(`${field} must be at least ${min} characters.`, field);
  if (s.length > max) throw new ValidationError(`${field} must be ${max} characters or fewer.`, field);
  return s;
}

export function requireEnum<T extends string>(v: unknown, allowed: readonly T[], field: string): T {
  if (typeof v !== 'string' || !allowed.includes(v as T)) {
    throw new ValidationError(`${field} must be one of: ${allowed.join(', ')}.`, field);
  }
  return v as T;
}

export function requireCoords(v: unknown): { lat: number; lng: number; address: string; city?: string } {
  const loc = (v ?? {}) as Record<string, unknown>;
  const lat = Number(loc.lat);
  const lng = Number(loc.lng);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw new ValidationError('location.lat must be between -90 and 90.', 'location');
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) throw new ValidationError('location.lng must be between -180 and 180.', 'location');
  const address = str(loc.address) || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  if (address.length > 300) throw new ValidationError('location.address is too long.', 'location');
  const city = str(loc.city) || undefined;
  return { lat, lng, address, city };
}

export function requirePastDate(v: unknown, field: string): string {
  const d = v ? new Date(String(v)) : new Date();
  if (Number.isNaN(d.getTime())) throw new ValidationError(`${field} must be a valid date.`, field);
  // Allow a little clock skew, but not dates in the future.
  if (d.getTime() > Date.now() + 5 * 60 * 1000) throw new ValidationError(`${field} cannot be in the future.`, field);
  return d.toISOString();
}

/** Photos must be real URLs (uploaded via /api/uploads or an https link) – never inline base64. */
export function requireImageUrls(v: unknown): string[] {
  if (v == null) return [];
  if (!Array.isArray(v)) throw new ValidationError('images must be an array of URLs.', 'images');
  if (v.length > LIMITS.maxImages) throw new ValidationError(`You can attach at most ${LIMITS.maxImages} photos.`, 'images');
  return v.map((u) => {
    const s = str(u);
    if (s.startsWith('data:')) {
      throw new ValidationError('Inline (base64) images are not accepted – upload the photo via /api/uploads first.', 'images');
    }
    let parsed: URL;
    try {
      parsed = new URL(s);
    } catch {
      throw new ValidationError(`"${s.slice(0, 40)}" is not a valid image URL.`, 'images');
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new ValidationError('Image URLs must use http(s).', 'images');
    }
    if (s.length > 1000) throw new ValidationError('Image URL is too long.', 'images');
    return s;
  });
}

export function optionalQuestions(v: unknown, required: boolean): [string, string, string] | undefined {
  if (v == null || (Array.isArray(v) && v.every((q) => !str(q)))) {
    if (required) throw new ValidationError('Found items need 3 verification questions so owners can prove ownership.', 'verificationQuestions');
    return undefined;
  }
  if (!Array.isArray(v) || v.length !== 3) throw new ValidationError('Provide exactly 3 verification questions.', 'verificationQuestions');
  const qs = v.map((q, i) => requireText(q, `Question ${i + 1}`, 5, LIMITS.questionMax));
  return [qs[0], qs[1], qs[2]];
}
