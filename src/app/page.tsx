'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Item, ItemType, Category, User, FilterState, GeoLocation } from '@/types';
import { getStoredUser, setStoredUser, filterItems } from '@/lib/itemService';
import { ALREADY_CLAIMED_ERROR } from '@/lib/claims';
import { api, UNAUTHORIZED_EVENT } from '@/lib/api';
import ChatPanel from '@/components/ChatPanel';
import { getCurrentPosition, reverseGeocodePlace } from '@/lib/geo';
import LocationPicker from '@/components/LocationPicker';
import Navbar from '@/components/Navbar';
import ItemCard from '@/components/ItemCard';
import ItemDetailModal from '@/components/ItemDetailModal';
import ClaimModal from '@/components/ClaimModal';
import ReportItemModal from '@/components/ReportItemModal';
import AuthModal from '@/components/AuthModal';
import LogoutModal from '@/components/LogoutModal';
import GlobalLoader from '@/components/GlobalLoader';
import { isOwnItem, OWN_ITEM_CLAIM_ERROR } from '@/lib/ownership';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import { fetchCurrentUser, loginOrRegisterWithGoogle, logoutRequest } from '@/lib/authClient';
import {
  Search,
  Filter,
  MapPin,
  Calendar,
  Grid,
  Map as MapIcon,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Layers,
  Loader2,
} from 'lucide-react';

const MapComponent = dynamic(() => import('@/components/MapComponent'), { ssr: false });

export default function HomePage() {
  const [items, setItems] = useState<Item[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [itemsError, setItemsError] = useState<string | null>(null);

  // In-app messaging
  const [chatOpen, setChatOpen] = useState(false);
  const [chatConversationId, setChatConversationId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  // Active Modals
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [claimTargetItem, setClaimTargetItem] = useState<Item | null>(null);
  const [reportModalType, setReportModalType] = useState<ItemType | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [authPromptMessage, setAuthPromptMessage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<
    | { type: 'report'; itemType: ItemType }
    | { type: 'claim'; item: Item }
    | null
  >(null);

  // View state: 'split' | 'grid' | 'map'
  const [viewMode, setViewMode] = useState<'split' | 'grid' | 'map'>('split');

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<ItemType | 'all'>('found'); // Default to found items list as requested
  const [radiusKm, setRadiusKm] = useState<number>(5); // Default 5km radius
  const [centerLocation, setCenterLocation] = useState<GeoLocation | null>(null);
  // Hold the item list back until the first location lookup settles, so the
  // page doesn't flash unfiltered items and then re-filter by location.
  const [initialLocationResolved, setInitialLocationResolved] = useState(false);
  // The device's own position (once known) and whether the search center is that position.
  const [gpsPosition, setGpsPosition] = useState<GeoLocation | null>(null);
  const [isCurrentLocation, setIsCurrentLocation] = useState(false);

  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [isLocatingUser, setIsLocatingUser] = useState(true);

  // ---------------------------------------------------------------
  // Auth: validate the 24h session token, and handle the Google
  // OAuth callback (login if the user exists, otherwise register).
  // ---------------------------------------------------------------
  const processedGoogleToken = useRef<string | null>(null);

  // Items come from the API (Supabase). The server already leaves out the
  // signed-in user's own posts; `visibleItems` below double-checks client-side.
  const loadItems = useCallback(async (silent = false) => {
    try {
      setItems(await api.items.list({ silent }));
      setItemsError(null);
    } catch (e) {
      setItemsError(e instanceof Error ? e.message : 'Could not load items.');
    }
  }, []);

  useEffect(() => {
    let active = true;

    // Drop a stale/expired stored user (token is valid for 24h).
    fetchCurrentUser()
      .then((user) => {
        if (!active) return;
        setStoredUser(user);
        setCurrentUser(user);
      })
      .catch((e) => console.error('Session check failed:', e));

    const handleGoogleSession = async (accessToken: string) => {
      if (processedGoogleToken.current === accessToken) return;
      processedGoogleToken.current = accessToken;
      try {
        const user = await loginOrRegisterWithGoogle(accessToken);
        if (!active) return;
        setStoredUser(user);
        setCurrentUser(user);
        setShowAuthModal(false);
        loadItems(true);
      } catch (e) {
        console.error('Google sign-in failed:', e);
        alert('Google sign-in failed. Please try again.');
      } finally {
        // Our own 24h token now represents the session; drop Supabase's copy.
        await supabaseBrowser.auth.signOut({ scope: 'local' });
      }
    };

    const { data: sub } = supabaseBrowser.auth.onAuthStateChange((event, session) => {
      if (
        (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') &&
        session?.access_token &&
        session.user?.app_metadata?.provider === 'google'
      ) {
        // Defer: Supabase recommends not awaiting its own calls inside this callback.
        setTimeout(() => handleGoogleSession(session.access_token), 0);
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadItems]);

  // A protected API call came back 401 (token expired after 24h, or revoked):
  // sign the user out locally and ask them to sign in again.
  useEffect(() => {
    const onUnauthorized = () => {
      setStoredUser(null);
      setCurrentUser(null);
      setAuthPromptMessage('Your session has expired. Please sign in again to continue.');
      setShowAuthModal(true);
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  // Unread-message badge: poll quietly while signed in.
  useEffect(() => {
    if (!currentUser) {
      setUnreadCount(0);
      return;
    }
    let active = true;
    const poll = () =>
      api.chat
        .conversations(true)
        .then((r) => active && setUnreadCount(r.unreadTotal))
        .catch(() => {}); // messaging unavailable (e.g. migration not run) – badge just stays hidden
    poll();
    const timer = setInterval(poll, 30_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [currentUser]);

  // Load Initial Data & Auto-detect User's Current GPS Location
  useEffect(() => {
    setCurrentUser(getStoredUser());
    loadItems();

    // Shared link: /?item=<id> opens that item straight away.
    const deepLinkId = new URLSearchParams(window.location.search).get('item');
    if (deepLinkId) {
      api.items.get(deepLinkId, true).then((d) => setSelectedItem(d)).catch(() => {});
    }

    // Automatically detect user's current location to deliver location-specific results
    let isMounted = true;
    const autoDetectUserLocation = async () => {
      try {
        setIsLocatingUser(true);
        const pos = await getCurrentPosition();
        if (!isMounted) return;
        // Filter by coordinates right away; the readable place name follows.
        setCenterLocation({ lat: pos.lat, lng: pos.lng, address: 'Your current location' });
        setIsCurrentLocation(true);
        setInitialLocationResolved(true);
        const place = await reverseGeocodePlace(pos.lat, pos.lng);
        if (!isMounted) return;
        setGpsPosition(place);
        // Only fill in the name if the user hasn't picked another place meanwhile.
        setCenterLocation((prev) => (prev && prev.lat === pos.lat && prev.lng === pos.lng ? place : prev));
      } catch {
        // Location unavailable/denied: show all items; the user can search a location manually.
      } finally {
        if (isMounted) {
          setInitialLocationResolved(true);
          setIsLocatingUser(false);
        }
      }
    };

    autoDetectUserLocation();
    return () => {
      isMounted = false;
    };
  }, [loadItems]);

  const handleSelectLocation = (location: GeoLocation) => {
    setCenterLocation(location);
    setIsCurrentLocation(false);
  };

  const handleShowAllLocations = () => {
    setCenterLocation(null);
    setIsCurrentLocation(false);
  };

  // Filter calculations
  const filterState: FilterState = useMemo(() => ({
    searchQuery,
    category: selectedCategory,
    type: selectedType,
    radiusKm,
    centerLocation,
    startDate: startDate ? new Date(startDate).toISOString() : undefined,
    endDate: endDate ? new Date(endDate).toISOString() : undefined,
  }), [searchQuery, selectedCategory, selectedType, radiusKm, centerLocation, startDate, endDate]);

  // Home screen hides the logged-in user's own posts – they live under /profile.
  const visibleItems = useMemo(
    () => items.filter((i) => !isOwnItem(i, currentUser)),
    [items, currentUser]
  );

  // Every active filter except the Found/Lost tab – the tab counts come from this.
  const itemsMatchingFiltersAllTypes = useMemo(
    () => filterItems(visibleItems, { ...filterState, type: 'all' }),
    [visibleItems, filterState]
  );
  const foundCount = itemsMatchingFiltersAllTypes.filter((i) => i.type === 'found').length;
  const lostCount = itemsMatchingFiltersAllTypes.filter((i) => i.type === 'lost').length;

  const filteredItems = useMemo(
    () =>
      selectedType === 'all'
        ? itemsMatchingFiltersAllTypes
        : itemsMatchingFiltersAllTypes.filter((i) => i.type === selectedType),
    [itemsMatchingFiltersAllTypes, selectedType]
  );

  // Handle GPS Center Location
  const handleUseMyGPS = async () => {
    setIsLocatingUser(true);
    try {
      const pos = await getCurrentPosition();
      const place = await reverseGeocodePlace(pos.lat, pos.lng);
      setGpsPosition(place);
      setCenterLocation(place);
      setIsCurrentLocation(true);
    } catch {
      alert('Unable to retrieve GPS position. Please check your browser permissions.');
    } finally {
      setIsLocatingUser(false);
    }
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedType('found');
    setRadiusKm(5);
    setStartDate('');
    setEndDate('');
    // Back to the default: the user's current location if we have it, else everywhere.
    setCenterLocation(gpsPosition);
    setIsCurrentLocation(!!gpsPosition);
  };

  const handleItemCreated = (newItem: Item) => {
    // The new post is shown once as confirmation; it lives under /profile from now on.
    setSelectedItem(newItem);
    loadItems(true);
  };

  const handleLogout = async () => {
    await logoutRequest();
    await supabaseBrowser.auth.signOut({ scope: 'local' }).catch(() => {});
    setStoredUser(null);
    setCurrentUser(null);
    setShowLogoutModal(false);
    setChatOpen(false);
    loadItems(true);
  };

  const openChat = (conversationId: string | null = null) => {
    setChatConversationId(conversationId);
    setChatOpen(true);
  };

  // User-specific actions requiring login
  const handleOpenReport = (type: ItemType) => {
    if (!currentUser) {
      setAuthPromptMessage(
        type === 'found'
          ? 'Please sign in to report a found item with photos and location.'
          : 'Please sign in to report a lost item.'
      );
      setPendingAction({ type: 'report', itemType: type });
      setShowAuthModal(true);
      return;
    }
    setReportModalType(type);
  };

  const handleOpenClaim = (item: Item) => {
    if (!currentUser) {
      setAuthPromptMessage(`Please sign in to submit a 3-point ownership claim for "${item.title}".`);
      setPendingAction({ type: 'claim', item });
      setShowAuthModal(true);
      return;
    }
    if (isOwnItem(item, currentUser)) {
      alert(OWN_ITEM_CLAIM_ERROR);
      return;
    }
    if (item.myClaim) {
      alert(ALREADY_CLAIMED_ERROR);
      return;
    }
    if (item.status !== 'active') {
      alert('This item is no longer open for claims.');
      return;
    }
    setClaimTargetItem(item);
  };

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    loadItems(true);
    // Automatically resume pending action if user tried to do something before login
    if (pendingAction) {
      if (pendingAction.type === 'report') {
        setReportModalType(pendingAction.itemType);
      } else if (pendingAction.type === 'claim') {
        if (isOwnItem(pendingAction.item, user)) {
          alert(OWN_ITEM_CLAIM_ERROR);
        } else {
          // The API re-checks for duplicate claims, so a stale copy here is safe.
          setClaimTargetItem(pendingAction.item);
        }
      }
      setPendingAction(null);
      setAuthPromptMessage(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Navigation */}
      <Navbar
        currentUser={currentUser}
        onOpenAuth={() => {
          setAuthPromptMessage(null);
          setShowAuthModal(true);
        }}
        onLogout={() => setShowLogoutModal(true)}
        onOpenReport={handleOpenReport}
        unreadCount={unreadCount}
        onOpenMessages={() => openChat(null)}
        locationSlot={
          <LocationPicker
            value={centerLocation}
            isCurrentLocation={isCurrentLocation}
            isLocating={isLocatingUser}
            nearbyAnchor={gpsPosition ?? centerLocation}
            onUseCurrentLocation={handleUseMyGPS}
            onSelect={handleSelectLocation}
            onShowAll={handleShowAllLocations}
          />
        }
      />

      {itemsError && (
        <div className="bg-red-50 border-b border-red-100 text-center text-xs font-semibold text-red-800 px-4 py-2">
          {itemsError}{' '}
          <button onClick={() => loadItems()} className="underline font-bold">Retry</button>
        </div>
      )}

      {/* Hero & Filter Panel */}
      <section className="bg-white border-b border-gray-200/80 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
                Community Lost & Found
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                Browse found items near you, search within a 5km radius, or report something you found.
              </p>
            </div>

            {/* Quick Stats Banner */}
            <div className="flex items-center gap-3 bg-blue-50/70 border border-blue-100 px-4 py-2 rounded-2xl">
              <div className="flex items-center gap-2 text-xs font-semibold text-blue-900">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>{initialLocationResolved ? foundCount : '–'} Found Items</span>
              </div>
              <div className="h-4 w-px bg-blue-200"></div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-900">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>3-Proof Security</span>
              </div>
            </div>
          </div>

          {/* Primary Filter Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* 1. Search Query */}
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search items (e.g. iPhone, Wallet, Dog)..."
                className="w-full pl-9 pr-3 py-2.5 bg-gray-50 hover:bg-white focus:bg-white border border-gray-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
            </div>

            {/* 2. Category Selector */}
            <div className="relative">
              <Layers className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-gray-50 hover:bg-white focus:bg-white border border-gray-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition appearance-none cursor-pointer"
              >
                <option value="all">All Categories</option>
                <option value="electronics">Electronics</option>
                <option value="wallets">Wallets & Purses</option>
                <option value="keys">Keys & Fobs</option>
                <option value="bags">Bags & Backpacks</option>
                <option value="documents">IDs & Documents</option>
                <option value="jewelry">Jewelry & Watches</option>
                <option value="pets">Pets</option>
                <option value="clothing">Clothing & Accessories</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* 3. Search Radius (location is chosen from the picker in the navbar) */}
            <div className="relative">
              <MapPin className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={radiusKm}
                onChange={(e) => setRadiusKm(Number(e.target.value))}
                disabled={!centerLocation}
                title={centerLocation ? 'Search radius' : 'Pick a location in the top bar to search by distance'}
                className="w-full pl-9 pr-3 py-2.5 bg-gray-50 hover:bg-white focus:bg-white border border-gray-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition appearance-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
              >
                {centerLocation ? (
                  [1, 3, 5, 10, 25, 50, 100].map((km) => (
                    <option key={km} value={km}>Within {km} km</option>
                  ))
                ) : (
                  <option>Any distance</option>
                )}
              </select>
            </div>

            {/* 4. Date Range Filter */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  title="Lost/Found on or after this date"
                  className="w-full py-2 px-2.5 bg-gray-50 hover:bg-white border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={handleResetFilters}
                title="Reset all filters"
                className="p-2.5 rounded-xl border border-gray-200 text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition shrink-0"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Active Center Location Indicator */}
          {centerLocation && (
            <div className="mt-3 flex items-center justify-between text-xs text-blue-700 bg-blue-50/60 px-3 py-1.5 rounded-lg border border-blue-100">
              <div className="flex items-center gap-1.5 truncate">
                <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span className="truncate font-medium">
                  Filtering within <strong>{radiusKm} km</strong> of: {centerLocation.address}
                </span>
              </div>
              <button
                onClick={handleShowAllLocations}
                className="text-xs text-blue-500 hover:text-blue-800 font-semibold underline ml-2 shrink-0"
              >
                Clear Location
              </button>
            </div>
          )}

          {/* Subheader: Type Tabs + View Switcher */}
          <div className="mt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-t border-gray-100 pt-4">
            {/* Type Filter Tabs */}
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-full sm:w-auto">
              <button
                onClick={() => setSelectedType('found')}
                className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-bold transition ${
                  selectedType === 'found'
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Found Items ({initialLocationResolved ? foundCount : '–'})
              </button>
              <button
                onClick={() => setSelectedType('lost')}
                className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-bold transition ${
                  selectedType === 'lost'
                    ? 'bg-amber-500 text-white shadow'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Lost Items ({initialLocationResolved ? lostCount : '–'})
              </button>
              <button
                onClick={() => setSelectedType('all')}
                className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-bold transition ${
                  selectedType === 'all'
                    ? 'bg-gray-800 text-white shadow'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                All Reports ({initialLocationResolved ? foundCount + lostCount : '–'})
              </button>
            </div>

            {/* View Mode Buttons (Split / Grid / Map) */}
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl self-end">
              <button
                onClick={() => setViewMode('split')}
                title="Split Map & Grid"
                className={`hidden lg:flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  viewMode === 'split' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Split</span>
              </button>
              <button
                onClick={() => setViewMode('grid')}
                title="Grid View"
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  viewMode === 'grid' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600'
                }`}
              >
                <Grid className="w-3.5 h-3.5" />
                <span>Cards</span>
              </button>
              <button
                onClick={() => setViewMode('map')}
                title="Map View"
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  viewMode === 'map' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600'
                }`}
              >
                <MapIcon className="w-3.5 h-3.5" />
                <span>Map</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        {!initialLocationResolved ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-gray-500">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <p className="text-sm font-semibold">Finding items near you…</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="bg-white rounded-3xl border border-gray-200 p-8 sm:p-12 text-center max-w-lg mx-auto shadow-sm my-8">
            <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4">
              <MapPin className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">
              {centerLocation ? `No items reported within ${radiusKm}km of your location` : 'No matching items found'}
            </h3>
            <p className="text-xs sm:text-sm text-gray-500 mt-2 leading-relaxed">
              {centerLocation ? (
                <>
                  Searching near <strong className="text-gray-700">{centerLocation.address}</strong>. No items have been reported in this immediate {radiusKm}km radius yet.
                </>
              ) : (
                'Try increasing your search radius or clearing category filters.'
              )}
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={() => setRadiusKm(25)}
                className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold shadow hover:bg-blue-700 transition"
              >
                Expand Radius to 25 km
              </button>
              <button
                onClick={handleShowAllLocations}
                className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-200 transition"
              >
                Show All Global Items
              </button>
              <button
                onClick={() => handleOpenReport('found')}
                className="px-4 py-2.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold hover:bg-emerald-100 transition"
              >
                Report Item Here
              </button>
            </div>
          </div>
        ) : viewMode === 'split' ? (
          /* Split View (Cards on left, Interactive Map on right) */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredItems.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  onSelect={(i) => setSelectedItem(i)}
                  onClaimClick={(i) => handleOpenClaim(i)}
                  isOwner={isOwnItem(item, currentUser)}
                  myClaim={item.myClaim}
                />
              ))}
            </div>

            <div className="lg:col-span-5 sticky top-24">
              <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100 text-xs font-bold text-gray-700">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-blue-600" />
                    Interactive Map ({filteredItems.length} items)
                  </span>
                  <span className="text-[11px] text-gray-400 font-normal">Blue circle: {radiusKm}km radius</span>
                </div>
                <MapComponent
                  items={filteredItems}
                  centerLocation={centerLocation}
                  radiusKm={radiusKm}
                  onSelectItem={(item) => setSelectedItem(item)}
                  height="580px"
                />
              </div>
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          /* Full Grid View */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredItems.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                onSelect={(i) => setSelectedItem(i)}
                onClaimClick={(i) => handleOpenClaim(i)}
                isOwner={isOwnItem(item, currentUser)}
                myClaim={item.myClaim}
              />
            ))}
          </div>
        ) : (
          /* Full Map View */
          <div className="bg-white p-3 rounded-3xl border border-gray-200 shadow-sm">
            <MapComponent
              items={filteredItems}
              centerLocation={centerLocation}
              radiusKm={radiusKm}
              onSelectItem={(item) => setSelectedItem(item)}
              height="650px"
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto bg-white border-t border-gray-200 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-500">
          <div>
            <span className="font-bold text-gray-800">LostFound</span> &mdash; Geocoded community recovery system with 3-point claim verification.
          </div>
          <div className="flex items-center gap-4">
            <span>Powered by PostgreSQL / PostGIS</span>
            <span>&bull;</span>
            <button onClick={() => setShowAuthModal(true)} className="hover:text-blue-600 font-medium">
              Account Login
            </button>
          </div>
        </div>
      </footer>

      {/* Item Detail Modal */}
      {selectedItem && (
        <ItemDetailModal
          key={selectedItem.id}
          item={selectedItem}
          currentUser={currentUser}
          onClose={() => setSelectedItem(null)}
          onClaim={(item) => {
            setSelectedItem(null);
            handleOpenClaim(item);
          }}
          onChanged={() => loadItems(true)}
          onMessage={(conversationId) => openChat(conversationId)}
          onRequireLogin={(message) => {
            setAuthPromptMessage(message);
            setShowAuthModal(true);
          }}
        />
      )}

      {/* Claim Modal (3 Secret Proofs) */}
      {claimTargetItem && (
        <ClaimModal
          item={claimTargetItem}
          currentUser={currentUser}
          onClose={() => setClaimTargetItem(null)}
          onSuccess={() => {
            loadItems(true);
          }}
        />
      )}

      {/* Report Modal (Found or Lost) */}
      {reportModalType && (
        <ReportItemModal
          initialType={reportModalType}
          currentUser={currentUser}
          defaultLocation={centerLocation}
          onClose={() => setReportModalType(null)}
          onSuccess={handleItemCreated}
        />
      )}


      {/* Auth Modal with Multiple Methods (Google, Email/Password, Phone OTP) */}
      <AuthModal
        isOpen={showAuthModal}
        promptMessage={authPromptMessage}
        onClose={() => {
          setShowAuthModal(false);
          setAuthPromptMessage(null);
        }}
        onLoginSuccess={handleLoginSuccess}
      />

      <LogoutModal
        isOpen={showLogoutModal}
        userName={currentUser?.name}
        onCancel={() => setShowLogoutModal(false)}
        onConfirm={handleLogout}
      />

      <ChatPanel
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        currentUser={currentUser}
        initialConversationId={chatConversationId}
        onUnreadChange={setUnreadCount}
        onOpenItem={(itemId) => {
          setChatOpen(false);
          api.items.get(itemId).then((d) => setSelectedItem(d)).catch((e) => alert(e.message));
        }}
      />

      {/* Overlay shown while any API call is in flight */}
      <GlobalLoader />
    </div>
  );
}

