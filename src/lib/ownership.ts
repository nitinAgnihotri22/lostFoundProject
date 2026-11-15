// Shared (client + server) ownership check.
// Matches on user id, and also on email so items reported before the
// current auth system (older user ids) still count as the user's own.
type Owned = { userId?: string | null; userEmail?: string | null };
type Person = { id: string; email?: string | null } | null | undefined;

export function isOwnItem(item: Owned, user: Person): boolean {
  if (!user) return false;
  if (item.userId && item.userId === user.id) return true;
  const a = item.userEmail?.trim().toLowerCase();
  const b = user.email?.trim().toLowerCase();
  return !!a && !!b && a === b;
}

export const OWN_ITEM_CLAIM_ERROR = 'You cannot claim an item that you posted.';
