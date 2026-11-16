'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Calendar, CheckCircle2, Clock, Compass, Gift, Inbox, LogOut, Mail, MessageCircle,
  Package, Phone, Shield, ShieldCheck, XCircle,
} from 'lucide-react';
import { Claim, ClaimWithItem, Item, ProfileData, User } from '@/types';
import { getStoredUser, setStoredUser } from '@/lib/itemService';
import { api, ApiError, UNAUTHORIZED_EVENT } from '@/lib/api';
import { fetchCurrentUser, logoutRequest } from '@/lib/authClient';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import { getRejectionReason } from '@/lib/claims';
import ItemCard from '@/components/ItemCard';
import ItemDetailModal from '@/components/ItemDetailModal';
import LogoutModal from '@/components/LogoutModal';
import ClaimsReviewModal from '@/components/ClaimsReviewModal';
import ChatPanel from '@/components/ChatPanel';
import GlobalLoader from '@/components/GlobalLoader';

type Tab = 'posted' | 'claimed';

const CLAIM_STATUS: Record<Claim['status'], { label: string; className: string; Icon: typeof Clock }> = {
  pending: { label: 'Pending review', className: 'bg-amber-50 text-amber-700 border-amber-200', Icon: Clock },
  approved: { label: 'Approved', className: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: CheckCircle2 },
  rejected: { label: 'Rejected', className: 'bg-red-50 text-red-700 border-red-200', Icon: XCircle },
};

const ITEM_STATUS: Record<Item['status'], { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-emerald-100 text-emerald-800' },
  claimed: { label: 'Claimed', className: 'bg-blue-100 text-blue-800' },
  resolved: { label: 'Closed', className: 'bg-gray-200 text-gray-700' },
};

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1584824486509-112e4181ff6b?w=200&auto=format&fit=crop&q=80';
const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(() => null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [tab, setTab] = useState<Tab>('posted');
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [showLogout, setShowLogout] = useState(false);
  const [showInbox, setShowInbox] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatConversationId, setChatConversationId] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);

  const loadProfile = useCallback(async (silent = false) => {
    try {
      const data = await api.profile.get(silent);
      setProfile(data);
      setUser(data.user);
      setStoredUser(data.user);
      setUnread(data.stats.unreadMessages);
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 401)) console.error('Profile load failed:', e);
    }
  }, []);

  // Validate the session; bounce to the home page if it's gone.
  useEffect(() => {
    let active = true;
    const stored = getStoredUser();
    if (stored) setUser(stored);

    fetchCurrentUser()
      .then((u) => {
        if (!active) return;
        if (!u) {
          setStoredUser(null);
          router.replace('/');
          return;
        }
        setUser(u);
        loadProfile();
      })
      .catch(() => active && !stored && router.replace('/'));

    const onUnauthorized = () => {
      setStoredUser(null);
      router.replace('/');
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => {
      active = false;
      window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    };
  }, [router, loadProfile]);

  const handleLogout = async () => {
    await logoutRequest();
    await supabaseBrowser.auth.signOut({ scope: 'local' }).catch(() => {});
    setStoredUser(null);
    router.replace('/');
  };

  const openChatFor = async (itemId: string, recipientId?: string) => {
    try {
      const conv = await api.chat.start({ itemId, recipientId });
      setChatConversationId(conv.id);
      setChatOpen(true);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not open the chat.');
    }
  };

  const reviewClaim = async (claimId: string, status: 'approved' | 'rejected', reason?: string) => {
    try {
      const { autoRejected } = await api.claims.review(claimId, status, reason);
      await loadProfile(true);
      if (status === 'approved' && autoRejected) alert(`${autoRejected} other pending claim(s) on this item were automatically rejected.`);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not update the claim.');
    }
  };

  const openItemById = (itemId: string) => {
    const found = profile?.postedItems.find((i) => i.id === itemId);
    const fromClaim = profile?.myClaims.find((c) => c.itemId === itemId)?.item;
    if (found) setSelectedItem(found);
    else if (fromClaim) {
      // Minimal shell – the detail modal fetches the full record by id.
      setSelectedItem({
        id: fromClaim.id, type: fromClaim.type, title: fromClaim.title, description: '', category: 'other',
        images: fromClaim.image ? [fromClaim.image] : [], location: { lat: 0, lng: 0, address: '' },
        occurredAt: new Date().toISOString(), status: fromClaim.status, userId: fromClaim.posterId,
        userName: fromClaim.posterName ?? 'Poster', createdAt: new Date().toISOString(),
      });
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50">
        <GlobalLoader />
      </div>
    );
  }

  const stats = profile?.stats;
  const postedItems = profile?.postedItems ?? [];
  const myClaims = profile?.myClaims ?? [];
  const receivedClaims = profile?.receivedClaims ?? [];

  const tiles = [
    { label: 'Items posted', value: stats?.posted ?? 0, hint: `${stats?.postedFound ?? 0} found · ${stats?.postedLost ?? 0} lost`, Icon: Package, tone: 'bg-blue-50 text-blue-600' },
    { label: 'Items claimed', value: stats?.claimsMade ?? 0, hint: `${stats?.claimsApproved ?? 0} approved · ${stats?.claimsPending ?? 0} pending · ${stats?.claimsRejected ?? 0} rejected`, Icon: ShieldCheck, tone: 'bg-indigo-50 text-indigo-600' },
    { label: 'Items returned', value: stats?.returned ?? 0, hint: 'Your posts that reached their owner', Icon: Gift, tone: 'bg-emerald-50 text-emerald-600' },
    { label: 'Claims received', value: stats?.claimsReceived ?? 0, hint: `${stats?.claimsReceivedPending ?? 0} waiting for your review`, Icon: Inbox, tone: 'bg-amber-50 text-amber-600' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="sticky top-0 z-40 w-full bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 text-sm font-bold text-gray-700 hover:text-blue-600 transition">
            <ArrowLeft className="w-4 h-4" /> <span>Back to search</span>
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setChatConversationId(null); setChatOpen(true); }}
              className="relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 transition"
            >
              <MessageCircle className="w-4 h-4" /> <span className="hidden sm:inline">Messages</span>
              {unread > 0 && <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 rounded-full">{unread}</span>}
            </button>
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white">
                <Compass className="w-5 h-5" />
              </div>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 flex-1 space-y-6">
        {/* Profile card */}
        <section className="bg-white rounded-3xl border border-gray-200 shadow-sm p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-5">
          <img src={user.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name)}`} alt={user.name} className="w-20 h-20 rounded-full border-4 border-blue-100 object-cover shrink-0" />
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-black text-gray-900 truncate">{user.name}</h1>
            <div className="mt-2 flex flex-col gap-1 text-sm text-gray-600">
              <span className="flex items-center gap-2 min-w-0"><Mail className="w-4 h-4 text-gray-400 shrink-0" /><span className="truncate">{user.email}</span></span>
              {user.phone && <span className="flex items-center gap-2"><Phone className="w-4 h-4 text-gray-400 shrink-0" />{user.phone}</span>}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                {user.roleSource === 'google' ? 'Google account' : 'Email account'}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap sm:flex-col gap-2 self-start sm:self-center">
            <button onClick={() => setShowInbox(true)} className="relative flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 transition">
              <Shield className="w-4 h-4 text-blue-600" /> Claims Inbox ({receivedClaims.length})
              {(stats?.claimsReceivedPending ?? 0) > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{stats!.claimsReceivedPending} new</span>
              )}
            </button>
            <button onClick={() => setShowLogout(true)} className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-gray-300 text-sm font-bold text-gray-700 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition">
              <LogOut className="w-4 h-4" /> Log out
            </button>
          </div>
        </section>

        {/* Stats */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {tiles.map(({ label, value, hint, Icon, tone }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex items-center gap-3">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${tone}`}><Icon className="w-5 h-5" /></div>
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
            {([['posted', `Items posted (${postedItems.length})`], ['claimed', `Items claimed (${myClaims.length})`]] as const).map(([key, label]) => (
              <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-lg transition ${tab === key ? 'bg-white text-blue-600 shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}>
                {label}
              </button>
            ))}
          </div>

          {tab === 'posted' &&
            (postedItems.length === 0 ? (
              <EmptyState title="You haven't posted any items yet" body="Items you report as found or lost will appear here." />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {postedItems.map((item) => (
                  <div key={item.id} className="relative">
                    <div className="absolute top-3 left-3 z-10 flex gap-1.5">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full shadow ${ITEM_STATUS[item.status].className}`}>{ITEM_STATUS[item.status].label}</span>
                      {(item.claimCount ?? 0) > 0 && (
                        <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-white/95 text-blue-700 shadow">{item.claimCount} claim{item.claimCount === 1 ? '' : 's'}</span>
                      )}
                    </div>
                    <ItemCard item={item} isOwner onSelect={setSelectedItem} />
                  </div>
                ))}
              </div>
            ))}

          {tab === 'claimed' &&
            (myClaims.length === 0 ? (
              <EmptyState title="You haven't claimed any items yet" body="When you submit a 3-proof claim on a found item, you can track it here." />
            ) : (
              <ul className="space-y-3">
                {myClaims.map((claim) => (
                  <ClaimRow key={claim.id} claim={claim} onView={() => openItemById(claim.itemId)} onMessage={() => openChatFor(claim.itemId)} />
                ))}
              </ul>
            ))}
        </section>
      </main>

      {selectedItem && (
        <ItemDetailModal
          key={selectedItem.id}
          item={selectedItem}
          currentUser={user}
          onClose={() => setSelectedItem(null)}
          onClaim={() => setSelectedItem(null)}
          onChanged={() => loadProfile(true)}
          onMessage={(id) => { setChatConversationId(id); setChatOpen(true); }}
        />
      )}

      <ClaimsReviewModal isOpen={showInbox} claims={receivedClaims} onClose={() => setShowInbox(false)} onUpdate={reviewClaim} onMessage={(c) => openChatFor(c.itemId, c.claimantId)} />

      <ChatPanel
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        currentUser={user}
        initialConversationId={chatConversationId}
        onUnreadChange={setUnread}
        onOpenItem={(id) => { setChatOpen(false); openItemById(id); }}
      />

      <LogoutModal isOpen={showLogout} userName={user.name} onCancel={() => setShowLogout(false)} onConfirm={handleLogout} />
      <GlobalLoader />
    </div>
  );
}

function ClaimRow({ claim, onView, onMessage }: { claim: ClaimWithItem; onView: () => void; onMessage: () => void }) {
  const status = CLAIM_STATUS[claim.status];
  return (
    <li className="bg-white rounded-2xl border border-gray-200 shadow-sm p-3 sm:p-4 flex items-center gap-3 sm:gap-4">
      <button onClick={onView} className="shrink-0" aria-label="View item">
        <img src={claim.item?.image || FALLBACK_IMAGE} alt="" className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-cover bg-gray-100" />
      </button>
      <div className="flex-1 min-w-0">
        <button onClick={onView} className="font-bold text-gray-900 text-sm sm:text-base truncate text-left hover:text-blue-700 block max-w-full">
          {claim.item?.title || claim.itemTitle}
        </button>
        <div className="text-xs text-gray-500 flex flex-wrap items-center gap-x-2 mt-0.5">
          <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Claimed {formatDate(claim.createdAt)}</span>
          {claim.item?.posterName && <span>· Posted by {claim.item.posterName}</span>}
        </div>
        {claim.status === 'rejected' && (
          <div className="text-xs text-red-800 bg-red-50 border border-red-100 rounded-lg px-2 py-1 mt-1.5 line-clamp-3">
            <span className="font-semibold">Reason:</span> {getRejectionReason(claim) || 'No reason given by the poster.'}
          </div>
        )}
        {claim.status === 'approved' && (
          <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-lg px-2 py-1 mt-1.5">
            Approved – open the item to see the poster&apos;s contact details.
          </div>
        )}
      </div>
      <div className="flex flex-col items-end gap-2 shrink-0">
        <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full border ${status.className}`}>
          <status.Icon className="w-3.5 h-3.5" /> {status.label}
        </span>
        <button onClick={onMessage} className="text-[11px] font-bold text-blue-700 hover:underline flex items-center gap-1">
          <MessageCircle className="w-3.5 h-3.5" /> Message poster
        </button>
      </div>
    </li>
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
