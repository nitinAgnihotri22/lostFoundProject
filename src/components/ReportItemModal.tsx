'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Item, ItemType, Category, User, GeoLocation } from '@/types';
import { api } from '@/lib/api';
import { getCurrentPosition, reverseGeocode, searchAddress, AddressSearchResult } from '@/lib/geo';
import { X, MapPin, Sparkles, Navigation, Trash2, Camera, Search, Loader2 } from 'lucide-react';
import { useI18n } from '@/i18n/LanguageProvider';
import { CATEGORIES } from '@/lib/validation';

const MapComponent = dynamic(() => import('./MapComponent'), { ssr: false });

interface ReportItemModalProps {
  initialType?: ItemType;
  currentUser: User | null;
  defaultLocation?: GeoLocation | null;
  onClose: () => void;
  onSuccess: (newItem: Item) => void;
}

export default function ReportItemModal({
  initialType = 'found',
  currentUser,
  defaultLocation,
  onClose,
  onSuccess,
}: ReportItemModalProps) {
  const { t } = useI18n();
  const [type, setType] = useState<ItemType>(initialType);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<Category>('electronics');
  const [description, setDescription] = useState('');
  const [occurredAt, setOccurredAt] = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  });

  // Geocode location state initialized with detected user location
  const [coords, setCoords] = useState<{ lat: number; lng: number }>(() => ({
    lat: defaultLocation?.lat || 37.7749,
    lng: defaultLocation?.lng || -122.4194,
  }));
  const [address, setAddress] = useState(defaultLocation?.address || 'San Francisco, CA');
  const [isLocating, setIsLocating] = useState(false);

  // Address search autocomplete state
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSearchResult[]>([]);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [showAddressDropdown, setShowAddressDropdown] = useState(false);

  // Images state
  const [images, setImages] = useState<string[]>([]);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [uploading, setUploading] = useState(0); // photos currently being uploaded
  const MAX_PHOTOS = 6;
  const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

  // 3 Verification questions
  // Defaults are written in the poster's current language; claimants see them exactly as saved.
  const [q1, setQ1] = useState(() => t('report.q1Default'));
  const [q2, setQ2] = useState(() => t('report.q2Default'));
  const [q3, setQ3] = useState(() => t('report.q3Default'));

  const [submitting, setSubmitting] = useState(false);

  // Debounced search for address typing
  useEffect(() => {
    if (!address || address.length < 3 || !showAddressDropdown) {
      setAddressSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingAddress(true);
      try {
        const results = await searchAddress(address);
        setAddressSuggestions(results);
      } catch {
        setAddressSuggestions([]);
      } finally {
        setIsSearchingAddress(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [address, showAddressDropdown]);

  const handleSelectAddressSuggestion = (item: AddressSearchResult) => {
    setAddress(item.display_name);
    setCoords({ lat: item.lat, lng: item.lng });
    setShowAddressDropdown(false);
  };

  // Handle GPS location
  const handleUseGPS = async () => {
    setIsLocating(true);
    setShowAddressDropdown(false);
    try {
      const pos = await getCurrentPosition();
      setCoords(pos);
      const resolved = await reverseGeocode(pos.lat, pos.lng);
      setAddress(resolved);
    } catch {
      alert(t('report.gpsFailed'));
    } finally {
      setIsLocating(false);
    }
  };

  // Handle map click
  const handleCoordSelect = async (newCoord: { lat: number; lng: number }) => {
    setCoords(newCoord);
    setShowAddressDropdown(false);
    const resolved = await reverseGeocode(newCoord.lat, newCoord.lng);
    setAddress(resolved);
  };

  // Photos are uploaded to storage as soon as they're picked; the report stores their URLs.
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    if (images.length + files.length > MAX_PHOTOS) {
      alert(t('report.maxPhotos', { max: MAX_PHOTOS }));
      return;
    }
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        alert(t('report.notImage', { name: file.name }));
        continue;
      }
      if (file.size > MAX_PHOTO_BYTES) {
        alert(t('report.tooLarge', { name: file.name }));
        continue;
      }
      setUploading((n) => n + 1);
      try {
        const url = await api.uploads.photo(file);
        setImages((prev) => [...prev, url]);
      } catch (err) {
        alert(t('report.uploadFailed', { error: err instanceof Error ? err.message : '' }));
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };

  const handleAddImageUrl = () => {
    const url = imageUrlInput.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) {
      alert(t('report.fullUrl'));
      return;
    }
    if (images.length >= MAX_PHOTOS) {
      alert(t('report.maxPhotos', { max: MAX_PHOTOS }));
      return;
    }
    setImages((prev) => [...prev, url]);
    setImageUrlInput('');
  };

  const removeImage = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      alert(t('report.signIn'));
      return;
    }
    if (title.trim().length < 3 || description.trim().length < 10) {
      alert(t('report.titleDesc'));
      return;
    }
    if (type === 'found' && images.length === 0) {
      alert(t('report.needPhoto'));
      return;
    }
    if (type === 'found' && [q1, q2, q3].some((q) => q.trim().length < 5)) {
      alert(t('report.needQuestions'));
      return;
    }
    if (uploading > 0) {
      alert(t('report.waitUploads'));
      return;
    }
    if (new Date(occurredAt).getTime() > Date.now() + 5 * 60 * 1000) {
      alert(t('report.noFuture'));
      return;
    }

    setSubmitting(true);
    try {
      const hasQuestions = [q1, q2, q3].every((q) => q.trim().length >= 5);
      const created = await api.items.create({
        type,
        title: title.trim(),
        description: description.trim(),
        category,
        images,
        location: {
          lat: coords.lat,
          lng: coords.lng,
          address: address || `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`,
        },
        occurredAt: new Date(occurredAt).toISOString(),
        verificationQuestions: type === 'found' || hasQuestions ? [q1.trim(), q2.trim(), q3.trim()] : undefined,
      });
      onSuccess(created);
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : t('report.postFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div role="dialog" aria-modal="true" aria-labelledby="report-title" className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[92vh] supports-[height:100dvh]:max-h-[92dvh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 bg-gray-50/70">
          <div>
            <h2 id="report-title" className="text-lg font-bold text-gray-900">
              {type === 'found' ? t('report.titleFound') : t('report.titleLost')}
            </h2>
            <p className="text-xs text-gray-500">{t('report.subtitle')}</p>
          </div>
          <button
            onClick={onClose}
            aria-label={t('common.close')}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-5 sm:space-y-6 flex-1">
          {/* Type Selector (Found vs Lost) */}
          <div className="flex p-1 bg-gray-100 rounded-2xl" role="group">
            <button
              type="button"
              aria-pressed={type === 'found'}
              onClick={() => setType('found')}
              className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all ${
                type === 'found' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {t('report.iFound')}
            </button>
            <button
              type="button"
              aria-pressed={type === 'lost'}
              onClick={() => setType('lost')}
              className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all ${
                type === 'lost' ? 'bg-white text-amber-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {t('report.iLost')}
            </button>
          </div>

          {/* Title & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="report-title-input" className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                {t('report.itemTitle')} <span aria-hidden="true">*</span>
              </label>
              <input
                id="report-title-input"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('report.itemTitlePlaceholder')}
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="report-category" className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                {t('report.category')} <span aria-hidden="true">*</span>
              </label>
              <select
                id="report-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{t(`categoriesLong.${c}`)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Date & Time Found */}
          <div>
            <label htmlFor="report-when" className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              {type === 'found' ? t('report.whenFound') : t('report.whenLost')} <span aria-hidden="true">*</span>
            </label>
            <input
              id="report-when"
              type="datetime-local"
              required
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
              className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Images Section */}
          <div>
            <div className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>
                {type === 'found' ? t('report.photosFound') : t('report.photosLost')}
              </span>
              <span className="text-[0.6875rem] text-gray-500 font-normal normal-case">
                {type === 'found' ? t('report.photosHintFound') : t('report.photosHintLost')}
              </span>
            </div>

            {/* Thumbnail previews */}
            {images.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-3">
                {images.map((img, idx) => (
                  <div key={idx} className="relative group rounded-xl overflow-hidden aspect-square border border-gray-200">
                    <img src={img} alt={t('report.preview', { n: idx + 1 })} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      aria-label={t('report.removePhoto', { n: idx + 1 })}
                      className="absolute top-1 right-1 bg-red-600/90 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 focus:opacity-100 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2">
              <label className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-300 hover:border-blue-500 rounded-xl cursor-pointer text-xs font-semibold text-gray-600 hover:text-blue-600 transition">
                {uploading > 0 ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                <span>{uploading > 0 ? t('report.uploadingN', { count: uploading }) : t('report.upload')}</span>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="sr-only"
                />
              </label>

              <div className="flex-1 flex gap-2">
                <input
                  type="url"
                  placeholder={t('report.pasteUrl')}
                  aria-label={t('report.pasteUrl')}
                  value={imageUrlInput}
                  onChange={(e) => setImageUrlInput(e.target.value)}
                  className="flex-1 text-xs px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={handleAddImageUrl}
                  className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl"
                >
                  {t('common.add')}
                </button>
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="report-description" className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              {t('report.description')} <span aria-hidden="true">*</span>
            </label>
            <textarea
              id="report-description"
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('report.descriptionPlaceholder')}
              className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Geocode Location Picker with Map & Search Autocomplete */}
          <div className="relative">
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="report-address" className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-blue-600" />
                <span>{t('report.locationLabel')} <span aria-hidden="true">*</span></span>
              </label>

              <button
                type="button"
                onClick={handleUseGPS}
                disabled={isLocating}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 bg-blue-50 px-2.5 py-1 rounded-lg"
              >
                <Navigation className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
                <span>{isLocating ? t('report.detectingGps') : t('report.useGps')}</span>
              </button>
            </div>

            {/* Address input with live search dropdown */}
            <div className="relative mb-2">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="report-address"
                  type="text"
                  required
                  value={address}
                  onChange={(e) => {
                    setAddress(e.target.value);
                    setShowAddressDropdown(true);
                  }}
                  onFocus={() => {
                    if (addressSuggestions.length > 0) setShowAddressDropdown(true);
                  }}
                  placeholder={t('report.addressPlaceholder')}
                  className="w-full text-xs pl-9 pr-8 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
                {isSearchingAddress && (
                  <Loader2 className="w-4 h-4 text-blue-500 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
                )}
              </div>

              {/* Autocomplete Suggestions Dropdown */}
              {showAddressDropdown && addressSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-56 overflow-y-auto divide-y divide-gray-100">
                  {addressSuggestions.map((item) => (
                    <button
                      key={item.place_id}
                      type="button"
                      onClick={() => handleSelectAddressSuggestion(item)}
                      className="w-full text-left px-3.5 py-2.5 hover:bg-blue-50 text-xs text-gray-700 flex items-start gap-2 transition"
                    >
                      <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                      <span className="line-clamp-2 leading-relaxed">{item.display_name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Interactive Leaflet Pin Picker */}
            <MapComponent
              pickerMode={true}
              selectedCoord={coords}
              onCoordSelect={handleCoordSelect}
              height="200px"
            />
            <div className="mt-1 text-[0.6875rem] text-gray-500 font-mono text-right">
              {t('report.latLng', { lat: coords.lat.toFixed(5), lng: coords.lng.toFixed(5) })}
            </div>
          </div>

          {/* 3 Secret Verification Prompts (for Found items) */}
          {type === 'found' && (
            <div className="border border-blue-100 bg-blue-50/50 p-4 rounded-2xl space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                  {t('report.questionsTitle')}
                </h3>
              </div>
              <p className="text-xs text-gray-600">
                {t('report.questionsBody')}
              </p>

              <div>
                <label htmlFor="report-q1" className="block text-[0.6875rem] font-semibold text-gray-600 mb-1">{t('report.questionN', { n: 1 })}</label>
                <input
                  id="report-q1"
                  type="text"
                  value={q1}
                  onChange={(e) => setQ1(e.target.value)}
                  className="w-full text-xs px-3 py-1.5 rounded-lg border border-gray-200 bg-white"
                />
              </div>

              <div>
                <label htmlFor="report-q2" className="block text-[0.6875rem] font-semibold text-gray-600 mb-1">{t('report.questionN', { n: 2 })}</label>
                <input
                  id="report-q2"
                  type="text"
                  value={q2}
                  onChange={(e) => setQ2(e.target.value)}
                  className="w-full text-xs px-3 py-1.5 rounded-lg border border-gray-200 bg-white"
                />
              </div>

              <div>
                <label htmlFor="report-q3" className="block text-[0.6875rem] font-semibold text-gray-600 mb-1">{t('report.questionN', { n: 3 })}</label>
                <input
                  id="report-q3"
                  type="text"
                  value={q3}
                  onChange={(e) => setQ3(e.target.value)}
                  className="w-full text-xs px-3 py-1.5 rounded-lg border border-gray-200 bg-white"
                />
              </div>
            </div>
          )}

          {/* Submit Buttons */}
          <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`px-6 py-2.5 text-sm font-bold text-white rounded-xl shadow-md transition disabled:opacity-50 ${
                type === 'found' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'
              }`}
            >
              {submitting ? t('report.publishing') : type === 'found' ? t('report.publishFound') : t('report.publishLost')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

