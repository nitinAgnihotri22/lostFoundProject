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



const NOMINATIM_HEADERS = { 'Accept-Language': 'en' };

type NominatimAddress = Record<string, string | undefined>;

/** Short, human label for a place, e.g. "Andheri West, Mumbai" or "Paris, France". */
function shortPlaceLabel(addr: NominatimAddress | undefined, fallback: string): string {
  if (!addr) return fallback.split(',').slice(0, 2).join(',').trim() || fallback;
  const city = addr.city || addr.town || addr.village || addr.municipality || addr.county || addr.state_district;
  const local = addr.suburb || addr.neighbourhood || addr.city_district || addr.quarter || addr.hamlet;
  const parts = [local, city || addr.state || addr.country].filter(Boolean) as string[];
  if (parts.length === 1 && addr.country && parts[0] !== addr.country) parts.push(addr.country);
  return [...new Set(parts)].join(', ') || fallback;
}

/** Reverse geocode to both the full address and a short label (stored in `city`). */
export async function reverseGeocodePlace(lat: number, lng: number): Promise<GeoLocation> {
  const coords = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`,
      { headers: NOMINATIM_HEADERS }
    );
    if (!res.ok) throw new Error('Geocoding request failed');
    const data = await res.json();
    const address: string = data.display_name || coords;
    return { lat, lng, address, city: shortPlaceLabel(data.address, address) };
  } catch {
    return { lat, lng, address: `Location (${coords})`, city: coords };
  }
}

export interface PlaceResult extends GeoLocation {
  id: string;
  /** Short label, e.g. "Pune, India". */
  city: string;
  /** Secondary line, e.g. "Maharashtra, India". */
  subtitle: string;
}

/** Worldwide place search (cities, towns, landmarks, addresses). */
export async function searchPlaces(query: string, signal?: AbortSignal): Promise<PlaceResult[]> {
  if (!query || query.trim().length < 2) return [];
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query.trim())}&limit=8&addressdetails=1`,
    { headers: NOMINATIM_HEADERS, signal }
  );
  if (!res.ok) return [];
  const data: { place_id: number; display_name: string; name?: string; lat: string; lon: string; address?: NominatimAddress }[] =
    await res.json();
  return data.map((item) => {
    const [first, ...rest] = item.display_name.split(',').map((s) => s.trim());
    return {
      id: String(item.place_id),
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      address: item.display_name,
      city: item.name || first,
      subtitle: rest.slice(-3).join(', '),
    };
  });
}

export interface NearbyCity extends PlaceResult {
  distanceKm: number;
}

const nearbyCache = new Map<string, NearbyCity[]>();

/** Cities and towns within ~150 km of a point, nearest first (OpenStreetMap Overpass). */
export async function fetchNearbyCities(lat: number, lng: number, limit = 8): Promise<NearbyCity[]> {
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  const cached = nearbyCache.get(key);
  if (cached) return cached;

  const query = `[out:json][timeout:15];node(around:150000,${lat},${lng})[place~"^(city|town)$"][name];out tags 60;`;
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: new URLSearchParams({ data: query }),
  });
  if (!res.ok) throw new Error('Could not load nearby cities');
  const data: { elements: { id: number; lat: number; lon: number; tags: Record<string, string> }[] } = await res.json();

  const cities = data.elements
    .map((el) => {
      const name = el.tags['name:en'] || el.tags.name;
      const region = el.tags['is_in:state'] || el.tags['addr:state'] || el.tags['is_in'] || '';
      return {
        id: `osm-${el.id}`,
        lat: el.lat,
        lng: el.lon,
        city: name,
        address: region ? `${name}, ${region}` : name,
        subtitle: el.tags.place === 'city' ? 'City' : 'Town',
        distanceKm: calculateDistanceKm(lat, lng, el.lat, el.lon),
        isCity: el.tags.place === 'city',
      };
    })
    // Bigger places first within similar distances, so a city 20 km away beats a hamlet-sized town 15 km away.
    .sort((a, b) => a.distanceKm * (a.isCity ? 0.6 : 1) - b.distanceKm * (b.isCity ? 0.6 : 1))
    .slice(0, limit)
    .map(({ isCity: _isCity, ...c }) => c)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  nearbyCache.set(key, cities);
  return cities;
}
