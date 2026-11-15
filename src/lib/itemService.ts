'use client';

import { Item, Claim, User, FilterState } from '@/types';
import { INITIAL_ITEMS } from './mockData';
import { calculateDistanceKm } from './geo';

const ITEMS_STORAGE_KEY = 'lostfound_items_v1';
const CLAIMS_STORAGE_KEY = 'lostfound_claims_v1';
const USER_STORAGE_KEY = 'lostfound_user_v1';

export const CURRENT_DEFAULT_USER: User = {
  id: 'user-me',
  name: 'Alex Morgan',
  email: 'alex.morgan@example.com',
  phone: '+1 (555) 349-1122',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
};

export function getStoredUser(): User | null {
  if (typeof window === 'undefined') return null;
  try {
    const data = localStorage.getItem(USER_STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export function setStoredUser(user: User | null): void {
  if (typeof window === 'undefined') return;
  if (!user) {
    localStorage.removeItem(USER_STORAGE_KEY);
  } else {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  }
}

export function getStoredItems(): Item[] {
  if (typeof window === 'undefined') return INITIAL_ITEMS;
  try {
    const data = localStorage.getItem(ITEMS_STORAGE_KEY);
    if (!data) {
      localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(INITIAL_ITEMS));
      return INITIAL_ITEMS;
    }
    return JSON.parse(data);
  } catch {
    return INITIAL_ITEMS;
  }
}

export function saveItem(newItem: Omit<Item, 'id' | 'createdAt' | 'status'>): Item {
  const items = getStoredItems();
  const created: Item = {
    ...newItem,
    id: `item-${Date.now()}`,
    status: 'active',
    createdAt: new Date().toISOString(),
  };
  const updated = [created, ...items];
  if (typeof window !== 'undefined') {
    localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(updated));
  }
  return created;
}

export function getStoredClaims(): Claim[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(CLAIMS_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function submitClaim(
  item: Item,
  claimant: User,
  proofs: { proof1: string; proof2: string; proof3: string; phone: string }
): Claim {
  const claims = getStoredClaims();
  const newClaim: Claim = {
    id: `claim-${Date.now()}`,
    itemId: item.id,
    itemTitle: item.title,
    claimantId: claimant.id,
    claimantName: claimant.name,
    claimantEmail: claimant.email,
    claimantPhone: proofs.phone || claimant.phone || '',
    proof1: proofs.proof1,
    proof2: proofs.proof2,
    proof3: proofs.proof3,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  const updatedClaims = [newClaim, ...claims];
  if (typeof window !== 'undefined') {
    localStorage.setItem(CLAIMS_STORAGE_KEY, JSON.stringify(updatedClaims));
  }
  return newClaim;
}

export function updateClaimStatus(
  claimId: string,
  status: 'approved' | 'rejected',
  notes?: string
): Claim[] {
  const claims = getStoredClaims();
  const updated = claims.map((c) => {
    if (c.id === claimId) {
      return {
        ...c,
        status,
        rejectionReason: status === 'rejected' ? notes : undefined,
        finderNotes: status === 'approved' ? notes : undefined,
        reviewedAt: new Date().toISOString(),
      };
    }
    return c;
  });

  if (typeof window !== 'undefined') {
    localStorage.setItem(CLAIMS_STORAGE_KEY, JSON.stringify(updated));
  }
  return updated;
}

export function filterItems(items: Item[], filters: FilterState): (Item & { distanceKm?: number })[] {
  return items
    .map((item) => {
      let distanceKm: number | undefined = undefined;
      if (filters.centerLocation) {
        distanceKm = calculateDistanceKm(
          filters.centerLocation.lat,
          filters.centerLocation.lng,
          item.location.lat,
          item.location.lng
        );
      }
      return { ...item, distanceKm };
    })
    .filter((item) => {
      // 1. Type filter
      if (filters.type !== 'all' && item.type !== filters.type) {
        return false;
      }

      // 2. Category filter
      if (filters.category && filters.category !== 'all' && item.category !== filters.category) {
        return false;
      }

      // 3. Search query
      if (filters.searchQuery) {
        const q = filters.searchQuery.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesDesc = item.description.toLowerCase().includes(q);
        const matchesLoc = item.location.address.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesLoc) {
          return false;
        }
      }

      // 4. Radius filter (e.g. 5km)
      if (filters.centerLocation && item.distanceKm !== undefined) {
        if (item.distanceKm > filters.radiusKm) {
          return false;
        }
      }

      // 5. Date-time filter
      if (filters.startDate) {
        const itemDate = new Date(item.occurredAt).getTime();
        const start = new Date(filters.startDate).getTime();
        if (itemDate < start) return false;
      }

      if (filters.endDate) {
        const itemDate = new Date(item.occurredAt).getTime();
        const end = new Date(filters.endDate).getTime();
        if (itemDate > end) return false;
      }

      return true;
    })
    .sort((a, b) => {
      // Sort by distance if location selected, otherwise by occurredAt descending
      if (a.distanceKm !== undefined && b.distanceKm !== undefined) {
        return a.distanceKm - b.distanceKm;
      }
      return new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime();
    });
}

