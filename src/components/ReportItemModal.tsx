'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Item, ItemType, Category, User, GeoLocation } from '@/types';
import { saveItem } from '@/lib/itemService';
import { getCurrentPosition, reverseGeocode, searchAddress, AddressSearchResult } from '@/lib/geo';
import { X, Upload, MapPin, Sparkles, Navigation, Plus, Trash2, Camera, Search, Loader2 } from 'lucide-react';

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

  // 3 Verification questions
  const [q1, setQ1] = useState('What unique marking, scratch, or color variation does it have?');
  const [q2, setQ2] = useState('What is inside or attached that is not visible in the photo?');
  const [q3, setQ3] = useState('What lock screen wallpaper, password hint, or serial detail can you prove?');

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
      alert('Could not access GPS location. Please select a spot on the map.');
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

  // Handle image file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        if (uploadEvent.target?.result) {
          setImages((prev) => [...prev, uploadEvent.target!.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleAddImageUrl = () => {
    if (imageUrlInput.trim()) {
      setImages((prev) => [...prev, imageUrlInput.trim()]);
      setImageUrlInput('');
    }
  };

  const removeImage = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      alert('Please fill in both the title and description.');
      return;
    }

    // Images are mandatory only for found items
    if (type === 'found' && images.length === 0) {
      alert('Please add at least one photo of the found item so owners can identify it.');
      return;
    }

    setSubmitting(true);
    const user = currentUser || {
      id: 'guest-' + Date.now(),
      name: 'Community Member',
      email: 'user@example.com',
    };

    const created = saveItem({
      type,
      title,
      description,
      category,
      images,
      location: {
        lat: coords.lat,
        lng: coords.lng,
        address: address || `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`,
      },
      occurredAt: new Date(occurredAt).toISOString(),
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      userPhone: user.phone,
      verificationQuestions: [q1, q2, q3],
    });

    setTimeout(() => {
      setSubmitting(false);
      onSuccess(created);
      onClose();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/70">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {type === 'found' ? 'Report a Found Item' : 'Report a Lost Item'}
            </h2>
            <p className="text-xs text-gray-500">Provide accurate details & geocode location to reunite items</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-6 flex-1">
          {/* Type Selector (Found vs Lost) */}
          <div className="flex p-1 bg-gray-100 rounded-2xl">
            <button
              type="button"
              onClick={() => setType('found')}
              className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all ${
                type === 'found' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              🎉 I Found An Item
            </button>
            <button
              type="button"
              onClick={() => setType('lost')}
              className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all ${
                type === 'lost' ? 'bg-white text-amber-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              🔍 I Lost An Item
            </button>
          </div>

          {/* Title & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Item Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Black Leather Fossil Wallet"
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Category *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="electronics">Electronics (Phone, Laptop, Earbuds)</option>
                <option value="wallets">Wallets & Purses</option>
                <option value="keys">Keys & Keychains</option>
                <option value="bags">Bags & Backpacks</option>
                <option value="documents">IDs, Cards & Documents</option>
                <option value="jewelry">Jewelry & Watches</option>
                <option value="pets">Pets</option>
                <option value="clothing">Clothing & Eyewear</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {/* Date & Time Found */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              {type === 'found' ? 'Date & Time Found *' : 'Date & Time Lost *'}
            </label>
            <input
              type="datetime-local"
              required
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
              className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Images Section */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>
                Item Photos {type === 'found' ? '* (Mandatory for Found Items)' : '(Optional for Lost Items)'}
              </span>
              <span className="text-[11px] text-gray-400 font-normal">
                {type === 'found' ? 'At least 1 photo required' : 'Add if you have one'}
              </span>
            </label>

            {/* Thumbnail previews */}
            {images.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-3">
                {images.map((img, idx) => (
                  <div key={idx} className="relative group rounded-xl overflow-hidden aspect-square border border-gray-200">
                    <img src={img} alt="preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      className="absolute top-1 right-1 bg-red-600/90 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2">
              <label className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-300 hover:border-blue-500 rounded-xl cursor-pointer text-xs font-semibold text-gray-600 hover:text-blue-600 transition">
                <Camera className="w-4 h-4" />
                <span>Upload from Device</span>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              <div className="flex-1 flex gap-2">
                <input
                  type="url"
                  placeholder="Or paste image URL"
                  value={imageUrlInput}
                  onChange={(e) => setImageUrlInput(e.target.value)}
                  className="flex-1 text-xs px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={handleAddImageUrl}
                  className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl"
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Public Description *
            </label>
            <textarea
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe where it was found, general condition, color, and location landmarks. (Tip: Do NOT disclose secret identifying marks or serial numbers here!)"
              className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Geocode Location Picker with Map & Search Autocomplete */}
          <div className="relative">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-blue-600" />
                <span>Geocode Location * (Search address or click on map)</span>
              </label>

              <button
                type="button"
                onClick={handleUseGPS}
                disabled={isLocating}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 bg-blue-50 px-2.5 py-1 rounded-lg"
              >
                <Navigation className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
                <span>{isLocating ? 'Detecting GPS...' : 'Use My GPS'}</span>
              </button>
            </div>

            {/* Address input with live search dropdown */}
            <div className="relative mb-2">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
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
                  placeholder="Type address or landmark (e.g. Times Square, Central Park, Baker St)..."
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
            <div className="mt-1 text-[11px] text-gray-500 font-mono text-right">
              Latitude: {coords.lat.toFixed(5)} | Longitude: {coords.lng.toFixed(5)}
            </div>
          </div>

          {/* 3 Secret Verification Prompts (for Found items) */}
          {type === 'found' && (
            <div className="border border-blue-100 bg-blue-50/50 p-4 rounded-2xl space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                  3 Secret Owner Verification Questions
                </h4>
              </div>
              <p className="text-xs text-gray-600">
                Claimants will be required to answer these 3 questions correctly before getting your contact info.
              </p>

              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">Question 1:</label>
                <input
                  type="text"
                  value={q1}
                  onChange={(e) => setQ1(e.target.value)}
                  className="w-full text-xs px-3 py-1.5 rounded-lg border border-gray-200 bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">Question 2:</label>
                <input
                  type="text"
                  value={q2}
                  onChange={(e) => setQ2(e.target.value)}
                  className="w-full text-xs px-3 py-1.5 rounded-lg border border-gray-200 bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">Question 3:</label>
                <input
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
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`px-6 py-2.5 text-sm font-bold text-white rounded-xl shadow-md transition disabled:opacity-50 ${
                type === 'found' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'
              }`}
            >
              {submitting ? 'Publishing Report...' : `Publish ${type === 'found' ? 'Found' : 'Lost'} Report`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

