'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Compass,
  Gift,
  LogOut,
  Mail,
  Package,
  Phone,
  Shield,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { Claim, Item, User } from '@/types';
import { getStoredClaims, getStoredItems, getStoredUser, setStoredUser } from '@/lib/itemService';
import { fetchCurrentUser, logoutRequest } from '@/lib/authClient';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import { isOwnItem } from '@/lib/ownership';
import { getRejectionReason, isClaimedBy } from '@/lib/claims';
import ItemCard from '@/components/ItemCard';
import ItemDetailModal from '@/components/ItemDetailModal';
import LogoutModal from '@/components/LogoutModal';
import ClaimsReviewModal from '@/components/ClaimsReviewModal';
import GlobalLoader from '@/components/GlobalLoader';

type Tab = 'posted' | 'claimed';

const CLAIM_STATUS: Record<Claim['status'], { label: string; className: string; Icon: typeof Clock }> = {
  pending: { label: 'Already claimed · Pending', className: 'bg-amber-50 text-amber-700 border-amber-200', Icon: Clock },
  approved: { label: 'Approved', className: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: CheckCircle2 },
  rejected: { label: 'Rejected', className: 'bg-red-50 text-red-700 border-red-200', Icon: XCircle },
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });


export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [checked, setChecked] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [tab, setTab] = useState<Tab>('posted');
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [showLogout, setShowLogout] = useState(false);
  const [showInbox, setShowInbox] = useState(false);

  const reloadClaims = () => setClaims(getStoredClaims());

  // Load the user (stored copy first, then validate the 24h session token).
  useEffect(() => {
    let active = true;
    const stored = getStoredUser();
    if (stored) setUser(stored);
    setItems(getStoredItems());
    setClaims(getStoredClaims());

    fetchCurrentUser()
      .then((u) => {
        if (!active) return;
        setStoredUser(u);
        setUser(u);
        setChecked(true);
        if (!u) router.replace('/');
      })
      .catch(() => {
        // Network/server error – fall back to the stored user if we have one.
        if (!active) return;
        setChecked(true);
        if (!stored) router.replace('/');
      });

    return () => {
      active = false;
    };
  }, [router]);

  const postedItems = useMemo(
    () =>
      user
        ? items
            .filter((i) => isOwnItem(i, user))
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        : [],
    [items, user]
  );

  const myClaims = useMemo(
    () =>
      user
        ? claims
            .filter((c) => isClaimedBy(c, user))
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        : [],
    [claims, user]
  );

  // "Returned" = posted items that reached their owner (approved claim or closed status).
  const returnedCount = useMemo(() => {
    const approvedItemIds = new Set(claims.filter((c) => c.status === 'approved').map((c) => c.itemId));
    return postedItems.filter(
      (i) => i.status === 'claimed' || i.status === 'resolved' || approvedItemIds.has(i.id)
    ).length;
  }, [claims, postedItems]);

  // Claims inbox: claims other users submitted on items I posted.
  const receivedClaims = useMemo(() => {
    const myItemIds = new Set(postedItems.map((i) => i.id));
    return claims
      .filter((c) => myItemIds.has(c.itemId))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [claims, postedItems]);
  const pendingReceived = receivedClaims.filter((c) => c.status === 'pending').length;

  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const handleLogout = async () => {
    await logoutRequest();
    await supabaseBrowser.auth.signOut({ scope: 'local' }).catch(() => {});
    setStoredUser(null);
    router.replace('/');
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50">
        {checked && (
          <p className="pt-24 text-center text-sm text-gray-500">Redirecting…</p>
        )}
        <GlobalLoader />
      </div>
    );
  }

  const foundCount = postedItems.filter((i) => i.type === 'found').length;
  const lostCount = postedItems.length - foundCount;
  const approvedClaims = myClaims.filter((c) => c.status === 'approved').length;
  const pendingClaims = myClaims.filter((c) => c.status === 'pending').length;

  const stats = [
    {
      label: 'Items posted',
      value: postedItems.length,
      hint: `${foundCount} found · ${lostCount} lost`,
      Icon: Package,
      tone: 'bg-blue-50 text-blue-600',
    },
    {
      label: 'Items claimed',
      value: myClaims.length,
      hint: `${approvedClaims} approved · ${pendingClaims} pending`,
      Icon: ShieldCheck,
      tone: 'bg-indigo-50 text-indigo-600',
    },
    {
      label: 'Items returned',
      value: returnedCount,
      hint: 'Your posts that reached their owner',
      Icon: Gift,
      tone: 'bg-emerald-50 text-emerald-600',
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-bold text-gray-700 hover:text-blue-600 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to search</span>
          </Link>
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white">
              <Compass className="w-5 h-5" />
            </div>
            <span className="hidden sm:inline text-lg font-black tracking-tight text-gray-900">
              Lost<span className="text-blue-600">Found</span>
            </span>
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 flex-1 space-y-6">
        {/* Profile card */}
        <section className="bg-white rounded-3xl border border-gray-200 shadow-sm p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-5">
          <img
            src={user.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name)}`}
            alt={user.name}
            className="w-20 h-20 rounded-full border-4 border-blue-100 object-cover shrink-0"
          />
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-black text-gray-900 truncate">{user.name}</h1>
            <div className="mt-2 flex flex-col gap-1 text-sm text-gray-600">
              <span className="flex items-center gap-2 min-w-0">
                <Mail className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="truncate">{user.email}</span>
              </span>
              {user.phone && (
                <span className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-gray-400 shrink-0" />
                  {user.phone}
                </span>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                {user.roleSource === 'google' ? 'Google account' : 'Email account'}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap sm:flex-col gap-2 self-start sm:self-center">
            <button
              onClick={() => setShowInbox(true)}
              title="Review claims submitted on items you posted"
              className="relative flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 transition"
            >
              <Shield className="w-4 h-4 text-blue-600" />
              Claims Inbox ({receivedClaims.length})
              {pendingReceived > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {pendingReceived} new
                </span>
              )}
            </button>
            <button
              onClick={() => setShowLogout(true)}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-gray-300 text-sm font-bold text-gray-700 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition"
            >
              <LogOut className="w-4 h-4" />
              Log out
            </button>
          </div>
        </section>

        {/* Stats */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          {stats.map(({ label, value, hint, Icon, tone }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex items-center gap-4">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${tone}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-2xl font-black text-gray-900 tabular-nums leading-none">{value}</div>
                <div className="text-xs font-bold text-gray-700 mt-1">{label}</div>
                <div className="text-[11px] text-gray-500 truncate">{hint}</div>
              </div>
            </div>
          ))}
        </section>

        {/* Tabs */}
        <section>
          <div className="flex p-1 bg-gray-100 rounded-xl max-w-sm mb-4" role="tablist">
            {(
              [
                ['posted', `Items posted (${postedItems.length})`],
                ['claimed', `Items claimed (${myClaims.length})`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-lg transition ${
                  tab === key ? 'bg-white text-blue-600 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'posted' &&
            (postedItems.length === 0 ? (
              <EmptyState
                title="You haven't posted any items yet"
                body="Items you report as found or lost will appear here."
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {postedItems.map((item) => (
                  <ItemCard key={item.id} item={item} isOwner onSelect={setSelectedItem} />
                ))}
              </div>
            ))}

          {tab === 'claimed' &&
            (myClaims.length === 0 ? (
              <EmptyState
                title="You haven't claimed any items yet"
                body="When you submit a 3-proof claim on a found item, you can track it here."
              />
            ) : (
              <ul className="space-y-3">
                {myClaims.map((claim) => {
                  const item = itemsById.get(claim.itemId);
                  const status = CLAIM_STATUS[claim.status];
                  return (
                    <li key={claim.id}>
                      <button
                        type="button"
                        disabled={!item}
                        onClick={() => item && setSelectedItem(item)}
                        className="w-full text-left bg-white rounded-2xl border border-gray-200 shadow-sm p-3 sm:p-4 flex items-center gap-3 sm:gap-4 hover:border-blue-200 hover:shadow transition disabled:cursor-default disabled:hover:border-gray-200 disabled:hover:shadow-sm"
                      >
                        <img
                          src={
                            item?.images?.[0] ||
                            'https://images.unsplash.com/photo-1584824486509-112e4181ff6b?w=200&auto=format&fit=crop&q=80'
                          }
                          alt=""
                          className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-cover bg-gray-100 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-gray-900 text-sm sm:text-base truncate">
                            {item?.title || claim.itemTitle}
                          </div>
                          <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                            <Calendar className="w-3.5 h-3.5" />
                            Claimed {formatDate(claim.createdAt)}
                          </div>
                          {claim.status === 'rejected' ? (
                            <div className="text-xs text-red-800 bg-red-50 border border-red-100 rounded-lg px-2 py-1 mt-1.5 line-clamp-3">
                              <span className="font-semibold">Reason:</span>{' '}
                              {getRejectionReason(claim) || 'No reason given by the poster.'}
                            </div>
                          ) : (
                            claim.finderNotes && (
                              <div className="text-xs text-gray-600 mt-1 line-clamp-2">
                                <span className="font-semibold">Poster:</span> {claim.finderNotes}
                              </div>
                            )
                          )}
                        </div>
                        <span
                          className={`shrink-0 inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full border ${status.className}`}
                        >
                          <status.Icon className="w-3.5 h-3.5" />
                          <span>{status.label}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ))}
        </section>
      </main>

      {selectedItem && (
        <ItemDetailModal
          key={selectedItem.id}
          item={selectedItem}
          isOwner={isOwnItem(selectedItem, user)}
          currentUser={user}
          onClaimsChange={reloadClaims}
          onClose={() => setSelectedItem(null)}
          // Only items you've already claimed reach here without isOwner.
          onClaim={() => {
            setSelectedItem(null);
            alert("You've already submitted a claim for this item. Track its status under Items claimed.");
          }}
        />
      )}

      <ClaimsReviewModal
        isOpen={showInbox}
        claims={receivedClaims}
        onClose={() => setShowInbox(false)}
        onStatusChange={reloadClaims}
      />

      <LogoutModal
        isOpen={showLogout}
        userName={user.name}
        onCancel={() => setShowLogout(false)}
        onConfirm={handleLogout}
      />

      <GlobalLoader />
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="bg-white rounded-3xl border border-dashed border-gray-300 p-8 sm:p-10 text-center">
      <Package className="w-8 h-8 text-gray-300 mx-auto mb-3" />
      <h3 className="text-sm font-bold text-gray-800">{title}</h3>
      <p className="text-xs text-gray-500 mt-1">{body}</p>
    </div>
  );
}
