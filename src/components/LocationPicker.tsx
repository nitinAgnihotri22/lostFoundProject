'use client';

import React, { useEffect, useRef, useState } from 'react';
import { GeoLocation } from '@/types';
import { searchPlaces, PlaceResult } from '@/lib/geo';
import { MapPin, ChevronDown, Navigation, Search, Loader2, Globe, X } from 'lucide-react';
import { useI18n } from '@/i18n/LanguageProvider';

interface LocationPickerProps {
  /** Current search center; null = no location filter (all items). */
  value: GeoLocation | null;
  /** True when `value` is the device's own GPS position. */
  isCurrentLocation: boolean;
  isLocating: boolean;
  onUseCurrentLocation: () => void;
  onSelect: (location: GeoLocation) => void;
  onShowAll: () => void;
}

export default function LocationPicker({
  value,
  isCurrentLocation,
  isLocating,
  onUseCurrentLocation,
  onSelect,
  onShowAll,
}: LocationPickerProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Debounced worldwide search.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    const ctrl = new AbortController();
    setSearching(true);
    const timer = setTimeout(() => {
      searchPlaces(q, ctrl.signal)
        .then((r) => setResults(r))
        .catch(() => {})
        .finally(() => !ctrl.signal.aborted && setSearching(false));
    }, 350);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query]);

  const choose = (loc: GeoLocation) => {
    onSelect({ lat: loc.lat, lng: loc.lng, address: loc.address, city: loc.city });
    setQuery('');
    setOpen(false);
  };

  const caption = isLocating && !value ? t('location.detecting') : isCurrentLocation ? t('location.current') : value ? t('location.showingNear') : t('location.location');
  // Before the place name resolves, the address is a placeholder in whichever language was active.
  const placeName = value ? (value.city || (value.address === 'Your current location' ? t('location.yourCurrentLocation') : value.address)) : '';
  const label = isLocating && !value ? t('location.pleaseWait') : value ? placeName : t('location.allLocations');

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`${t('location.changeLocation')}: ${caption} – ${label}`}
        className="flex items-center gap-2 min-w-0 max-w-[160px] sm:max-w-[240px] pl-2 pr-2.5 py-1.5 rounded-xl hover:bg-gray-50 border border-transparent hover:border-gray-200 transition text-left"
      >
        {isLocating && !value ? (
          <Loader2 className="w-5 h-5 text-blue-600 animate-spin shrink-0" />
        ) : isCurrentLocation ? (
          <Navigation className="w-5 h-5 text-blue-600 fill-blue-600/15 shrink-0" />
        ) : value ? (
          <MapPin className="w-5 h-5 text-blue-600 shrink-0" />
        ) : (
          <Globe className="w-5 h-5 text-blue-600 shrink-0" />
        )}
        <span className="min-w-0 flex flex-col">
          <span className="text-[0.625rem] font-bold uppercase tracking-wider text-gray-500 leading-tight">{caption}</span>
          <span className="flex items-center gap-1 text-sm font-bold text-gray-900 leading-tight min-w-0">
            <span className="truncate" title={value?.address}>{label}</span>
            <ChevronDown className={`w-3.5 h-3.5 text-gray-500 shrink-0 transition ${open ? 'rotate-180' : ''}`} />
          </span>
        </span>
      </button>

      {open && (
        <div role="dialog" aria-label={t('location.changeLocation')} className="absolute left-0 top-full mt-2 w-[min(380px,calc(100vw-2rem))] bg-white border border-gray-200 rounded-2xl shadow-2xl z-50 overflow-hidden">
          {/* Search */}
          <div className="p-3 border-b border-gray-100">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('location.searchPlaceholder')}
                aria-label={t('location.searchPlaceholder')}
                className="w-full pl-9 pr-8 py-2.5 bg-gray-50 focus:bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {searching ? (
                <Loader2 className="w-4 h-4 text-blue-500 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
              ) : query ? (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                  aria-label={t('location.clearSearch')}
                >
                  <X className="w-4 h-4" />
                </button>
              ) : null}
            </div>
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {query.trim().length >= 2 ? (
              results.length > 0 ? (
                <ul className="py-1">
                  {results.map((r) => (
                    <li key={r.id}>
                      <PlaceRow icon={<MapPin className="w-4 h-4 text-blue-600" />} title={r.city} subtitle={r.subtitle} onClick={() => choose(r)} />
                    </li>
                  ))}
                </ul>
              ) : (
                !searching && <p className="px-4 py-6 text-center text-xs text-gray-500">{t('location.noPlaces', { query: query.trim() })}</p>
              )
            ) : (
              <>
                <div className="py-1">
                  <PlaceRow
                    icon={<Navigation className={`w-4 h-4 text-blue-600 ${isLocating ? 'animate-spin' : ''}`} />}
                    title={isLocating ? t('location.detectingYours') : t('location.useCurrent')}
                    subtitle={t('location.usingGps')}
                    highlight={isCurrentLocation}
                    onClick={() => {
                      onUseCurrentLocation();
                      setOpen(false);
                    }}
                  />
                  <PlaceRow
                    icon={<Globe className="w-4 h-4 text-gray-500" />}
                    title={t('location.allLocations')}
                    subtitle={t('location.showEverywhere')}
                    highlight={!value}
                    onClick={() => {
                      onShowAll();
                      setOpen(false);
                    }}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PlaceRow({
  icon,
  title,
  subtitle,
  highlight,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  highlight?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition hover:bg-blue-50 ${highlight ? 'bg-blue-50/60' : ''}`}
    >
      <span className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-gray-900 truncate">{title}</span>
        {subtitle && <span className="block text-xs text-gray-500 truncate">{subtitle}</span>}
      </span>
    </button>
  );
}
