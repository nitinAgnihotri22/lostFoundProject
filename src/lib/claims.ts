// Shared (client + server) claim helpers.
import { Claim } from '@/types';

type Person = { id: string; email?: string | null } | null | undefined;

/** True if `claim` was submitted by `user` (id match, or email for older records). */
export function isClaimedBy(claim: Pick<Claim, 'claimantId' | 'claimantEmail'>, user: Person): boolean {
  if (!user) return false;
  if (claim.claimantId === user.id) return true;
  const a = claim.claimantEmail?.trim().toLowerCase();
  const b = user.email?.trim().toLowerCase();
  return !!a && !!b && a === b;
}

/** The user's existing claim on an item, if any (most recent first). */
export function findUserClaim(claims: Claim[], itemId: string, user: Person): Claim | undefined {
  return claims
    .filter((c) => c.itemId === itemId && isClaimedBy(c, user))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
}

/** Rejection reason (falls back to finderNotes for claims rejected before rejectionReason existed). */
export const getRejectionReason = (claim: Pick<Claim, 'rejectionReason' | 'finderNotes'>) =>
  claim.rejectionReason || claim.finderNotes || '';

export const ALREADY_CLAIMED_ERROR = 'You have already claimed this item.';

/** Preset reasons offered to posters when rejecting a claim. */
export const REJECTION_REASONS = [
  'Proofs do not match the item',
  'Details are too vague to verify',
  'Item has already been returned to its owner',
  'Suspected fraudulent claim',
] as const;

export const CLAIM_STATUS_LABEL: Record<Claim['status'], string> = {
  pending: 'Already claimed · Pending review',
  approved: 'Already claimed · Approved',
  rejected: 'Claim rejected',
};
