// Validation for saved-search bodies (shared by POST and PATCH).
import { CATEGORIES, ValidationError } from '@/lib/validation';

export function searchInput(b: Record<string, any>, maxRadiusKm: number, partial: boolean): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const has = (k: string) => !partial || k in b;

  if (has('label')) {
    const label = String(b.label ?? '').trim();
    if (label.length < 2 || label.length > 80) throw new ValidationError('Give the alert a short name (2–80 characters).', 'label');
    out.label = label;
  }
  if (has('category')) {
    const c = b.category ? String(b.category) : null;
    if (c && !(CATEGORIES as readonly string[]).includes(c)) throw new ValidationError('Unknown category.', 'category');
    out.category = c;
  }
  if (has('keywords')) out.keywords = String(b.keywords ?? '').trim().slice(0, 200);
  if (has('location')) {
    const lat = Number(b.location?.lat);
    const lng = Number(b.location?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw new ValidationError('Choose where you lost it.', 'location');
    out.lat = lat;
    out.lng = lng;
    out.address = String(b.location?.address ?? '').slice(0, 300);
  }
  if (has('radiusKm')) {
    const r = Math.round(Number(b.radiusKm));
    if (!Number.isFinite(r) || r < 1) throw new ValidationError('Choose a search radius.', 'radiusKm');
    if (r > maxRadiusKm) throw new ValidationError(`Your plan allows alerts up to ${maxRadiusKm} km.`, 'radiusKm');
    out.radius_km = r;
  }
  if (has('lostOn')) {
    const d = b.lostOn ? String(b.lostOn).slice(0, 10) : null;
    if (d && (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Date.parse(d) > Date.now() + 86400_000)) throw new ValidationError('Enter the date you lost it.', 'lostOn');
    out.lost_on = d;
  }
  if (partial && typeof b.active === 'boolean') out.active = b.active;
  if (partial) out.updated_at = new Date().toISOString();
  return out;
}
