'use client';

// Client-side helpers that don't touch the API:
//  - the cached copy of the signed-in user (the httpOnly cookie is the real session)
//  - pure filtering/sorting of items already fetched from /api/items

import { Item, User, FilterState } from '@/types';
import { calculateDistanceKm } from './geo';

const USER_STORAGE_KEY = 'lostfound_user_v1';

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
  try {
    if (!user) localStorage.removeItem(USER_STORAGE_KEY);
    else localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  } catch {
    // Storage can be unavailable (private mode) – the cookie session still works.
  }
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
      if (filters.type !== 'all' && item.type !== filters.type) return false;
      if (filters.category && filters.category !== 'all' && item.category !== filters.category) return false;

      if (filters.searchQuery) {
        const q = filters.searchQuery.toLowerCase();
        const matches =
          item.title.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.location.address.toLowerCase().includes(q);
        if (!matches) return false;
      }

      if (filters.centerLocation && item.distanceKm !== undefined && item.distanceKm > filters.radiusKm) return false;

      const occurred = new Date(item.occurredAt).getTime();
      if (filters.startDate && occurred < new Date(filters.startDate).getTime()) return false;
      if (filters.endDate && occurred > new Date(filters.endDate).getTime()) return false;

      return true;
    })
    .sort((a, b) => {
      if (a.distanceKm !== undefined && b.distanceKm !== undefined) return a.distanceKm - b.distanceKm;
      return new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime();
    });
}
