import { GeoLocation } from '@/types';

/**
 * Calculates the great circle distance between two points in kilometers
 * using the Haversine formula.
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Check if a location is within a given radius in km
 */
export function isWithinRadius(
  center: GeoLocation,
  target: GeoLocation,
  radiusKm: number = 5
): boolean {
  const distance = calculateDistanceKm(
    center.lat,
    center.lng,
    target.lat,
    target.lng
  );
  return distance <= radiusKm;
}

/**
 * Get user's current GPS location via browser API
 */
export function getCurrentPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => {
        // Fallback with enableHighAccuracy: false and shorter timeout
        navigator.geolocation.getCurrentPosition(
          (fallbackPos) => {
            resolve({
              lat: fallbackPos.coords.latitude,
              lng: fallbackPos.coords.longitude,
            });
          },
          (err) => reject(err),
          { enableHighAccuracy: false, timeout: 6000, maximumAge: 300000 }
        );
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 }
    );
  });
}

/**
 * Approximate reverse geocode using OpenStreetMap Nominatim (client-safe)
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      {
        headers: {
          'Accept-Language': 'en',
          'User-Agent': 'LostFoundApp/1.0',
        },
      }
    );
    if (!res.ok) throw new Error('Geocoding request failed');
    const data = await res.json();
    return data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch {
    return `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
  }
}

export interface AddressSearchResult {
  place_id: number | string;
  display_name: string;
  lat: number;
  lng: number;
}

/**
 * Forward geocoding: search addresses by query string using OpenStreetMap Nominatim
 */
export async function searchAddress(query: string): Promise<AddressSearchResult[]> {
  if (!query || query.trim().length < 2) return [];
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`,
      {
        headers: {
          'Accept-Language': 'en',
          'User-Agent': 'LostFoundApp/1.0',
        },
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.map((item: { place_id: number | string; display_name: string; lat: string; lon: string }) => ({
      place_id: item.place_id,
      display_name: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
    }));
  } catch {
    return [];
  }
}


