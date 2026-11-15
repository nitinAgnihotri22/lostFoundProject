'use client';

import React, { useState } from 'react';
import { Claim, Item, User as AppUser } from '@/types';
import { CLAIM_STATUS_LABEL, findUserClaim, getRejectionReason } from '@/lib/claims';
import { X, MapPin, Calendar, User, ShieldCheck, Share2, AlertCircle, ChevronLeft, ChevronRight, Printer, ShieldAlert, Users } from 'lucide-react';
import PrintFlyerModal from './PrintFlyerModal';
import ClaimReviewCard from './ClaimReviewCard';
import { getStoredClaims, updateClaimStatus } from '@/lib/itemService';

const claimsForItem = (itemId?: string): Claim[] =>
  itemId
    ? getStoredClaims()
        .filter((c) => c.itemId === itemId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    : [];

interface ItemDetailModalProps {
  item: Item | null;
  onClose: () => void;
  onClaim: (item: Item) => void;
  /** True when the logged-in user posted this item – they can't claim it, but can review its claims. */
  isOwner?: boolean;
  /** Called after the poster approves/rejects a claim from this popup. */
  onClaimsChange?: () => void;
  /** Used to detect the viewer's own existing claim on this item. */
  currentUser?: AppUser | null;
}

export default function ItemDetailModal({
  item,
  onClose,
  onClaim,
  isOwner = false,
  onClaimsChange,
  currentUser,
}: ItemDetailModalProps) {
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [claims, setClaims] = useState<Claim[]>(() => claimsForItem(item?.id));
  const [copied, setCopied] = useState(false);
  const [showFlyerModal, setShowFlyerModal] = useState(false);

  if (!item) return null;

  const images = item.images && item.images.length > 0
    ? item.images
    : ['https://images.unsplash.com/photo-1584824486509-112e4181ff6b?w=800&auto=format&fit=crop&q=80'];

  const isFound = item.type === 'found';
  const claimCount = claims.length;
  const pendingCount = claims.filter((c) => c.status === 'pending').length;
  const myClaim = isOwner ? undefined : findUserClaim(claims, item.id, currentUser);

  const handleClaimUpdate = (claimId: string, status: 'approved' | 'rejected', reason?: string) => {
    updateClaimStatus(claimId, status, reason);
    setClaims(claimsForItem(item.id));
    onClaimsChange?.();
  };
  const formattedDate = new Date(item.occurredAt).toLocaleString('en-US', {
    dateStyle: 'full',
    timeStyle: 'short',
  });

  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: item.title,
          text: `Check out this ${item.type} item on LostFound: ${item.title}`,
          url,
        });
        return;
      } catch {
        // Fallback to clipboard if share was cancelled or failed
      }
    }

    // Safe clipboard copy with fallback
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = url;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      prompt('Copy this link to share:', url);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                isFound ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}
            >
              {isFound ? 'Found Item Report' : 'Lost Item Notice'}
            </span>
            <span className="text-xs font-semibold text-gray-500 capitalize bg-gray-200/70 px-2.5 py-1 rounded-md">
              {item.category}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFlyerModal(true)}
              className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-full transition flex items-center gap-1 text-xs font-semibold"
              title="Generate printable flyer"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Flyer</span>
            </button>
            <button
              onClick={handleShare}
              className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-full transition"
              title="Share report"
            >
              <Share2 className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-full transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Modal Content */}
        <div className="overflow-y-auto p-6 space-y-6 flex-1">
          {/* Image Gallery */}
          <div className="relative rounded-2xl overflow-hidden bg-gray-900 aspect-[16/10] max-h-[380px] shadow-inner">
            <img
              src={images[activeImageIdx]}
              alt={item.title}
              className="w-full h-full object-contain mx-auto"
            />

            {images.length > 1 && (
              <>
                <button
                  onClick={() => setActiveImageIdx((prev) => (prev > 0 ? prev - 1 : images.length - 1))}
                  className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white p-2 rounded-full backdrop-blur-sm transition"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setActiveImageIdx((prev) => (prev < images.length - 1 ? prev + 1 : 0))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white p-2 rounded-full backdrop-blur-sm transition"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
                {/* Thumbnails strip */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 bg-black/50 p-1.5 rounded-xl backdrop-blur-md">
                  {images.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveImageIdx(idx)}
                      className={`w-12 h-10 rounded-lg overflow-hidden border-2 transition ${
                        activeImageIdx === idx ? 'border-blue-500 scale-105' : 'border-transparent opacity-60'
                      }`}
                    >
                      <img src={img} alt="thumb" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Title & Metadata */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900 leading-snug">{item.title}</h1>
            <div
              className={`mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                claimCount > 0 ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-50 text-gray-500 border-gray-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              {claimCount === 0
                ? 'No claims received yet'
                : `${claimCount} ${claimCount === 1 ? 'claim' : 'claims'} received`}
              {isOwner && pendingCount > 0 && (
                <span className="ml-1 bg-red-500 text-white text-[10px] px-1.5 rounded-full">{pendingCount} pending</span>
              )}
            </div>
            
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-600 bg-blue-50/50 p-3.5 rounded-xl border border-blue-100">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-gray-800">Geocode Location:</div>
                  <div className="text-xs text-gray-600">{item.location.address}</div>
                  <div className="text-[11px] font-mono text-gray-400">
                    Coords: {item.location.lat.toFixed(5)}, {item.location.lng.toFixed(5)}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Calendar className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-gray-800">
                    {isFound ? 'Date & Time Found:' : 'Date & Time Lost:'}
                  </div>
                  <div className="text-xs text-gray-600">{formattedDate}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Viewer's own claim status */}
          {myClaim && (
            <div
              className={`p-4 rounded-xl border text-sm ${
                myClaim.status === 'approved'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : myClaim.status === 'rejected'
                  ? 'bg-red-50 border-red-200 text-red-900'
                  : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}
            >
              <div className="font-bold">
                {myClaim.status === 'pending' && 'You have already claimed this item. The poster is reviewing your proofs.'}
                {myClaim.status === 'approved' && 'Your claim was approved. The poster will contact you to return the item.'}
                {myClaim.status === 'rejected' && 'Your claim was rejected.'}
              </div>
              {myClaim.status === 'rejected' && (
                <div className="mt-1 text-xs">
                  <span className="font-semibold">Reason from the poster:</span>{' '}
                  {getRejectionReason(myClaim) || 'No reason given.'}
                </div>
              )}
              <div className="mt-1 text-xs opacity-80">
                Submitted {new Date(myClaim.createdAt).toLocaleDateString()}
              </div>
            </div>
          )}

          {/* Full Description */}
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-2">Description</h2>
            <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line bg-gray-50 p-4 rounded-xl border border-gray-100">
              {item.description}
            </div>
          </div>

          {/* Reporter & Verification Safety Card */}
          <div className="border border-emerald-100 bg-emerald-50/60 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-base shadow">
                {item.userName ? item.userName[0] : 'U'}
              </div>
              <div>
                <div className="text-xs text-gray-500 font-medium">Reported by</div>
                <div className="text-sm font-bold text-gray-800">{item.userName}</div>
                <div className="text-xs text-emerald-700 font-medium flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> Identity & Listing Verified
                </div>
              </div>
            </div>

            <div className="text-xs text-gray-600 max-w-xs">
              <span className="font-semibold text-gray-800">Security Rule:</span> To protect genuine owners, claimants must answer 3 private questions before contact details are exchanged.
            </div>
          </div>

          {/* Claims received – full list only for the person who posted the item */}
          {isOwner && (
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-2">
                Claims received ({claimCount})
              </h2>
              {claimCount === 0 ? (
                <div className="text-xs text-gray-500 bg-gray-50 p-4 rounded-xl border border-dashed border-gray-200 text-center">
                  No one has claimed this item yet. Claims will appear here for you to review.
                </div>
              ) : (
                <div className="space-y-3">
                  {claims.map((claim) => (
                    <ClaimReviewCard
                      key={claim.id}
                      claim={claim}
                      showItemTitle={false}
                      onUpdate={handleClaimUpdate}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-gray-100 bg-white flex items-center justify-between gap-3">
          {copied && <span className="text-xs text-green-600 font-semibold">Link copied to clipboard!</span>}
          <div className="flex items-center gap-3 ml-auto">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-semibold text-sm hover:bg-gray-100 transition"
            >
              Close
            </button>

            {isOwner ? (
              <span
                title="You posted this item, so you can't claim it"
                className="px-5 py-2.5 rounded-xl bg-gray-100 text-gray-500 font-semibold text-sm flex items-center gap-2 cursor-default"
              >
                <User className="w-4 h-4" />
                You posted this item
              </span>
            ) : myClaim ? (
              <span
                className={`px-5 py-2.5 rounded-xl font-semibold text-sm cursor-default ${
                  myClaim.status === 'approved'
                    ? 'bg-emerald-50 text-emerald-700'
                    : myClaim.status === 'rejected'
                    ? 'bg-red-50 text-red-700'
                    : 'bg-amber-50 text-amber-700'
                }`}
              >
                {CLAIM_STATUS_LABEL[myClaim.status]}
              </span>
            ) : isFound ? (
              <button
                onClick={() => {
                  onClose();
                  onClaim(item);
                }}
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md hover:shadow-lg transition flex items-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                Claim This Item
              </button>
            ) : (
              <a
                href={`mailto:${item.userEmail}?subject=Found your lost item: ${encodeURIComponent(item.title)}`}
                className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm shadow-md hover:shadow-lg transition"
              >
                Contact Owner
              </a>
            )}
          </div>
        </div>
      </div>

      {showFlyerModal && (
        <PrintFlyerModal
          item={item}
          onClose={() => setShowFlyerModal(false)}
        />
      )}
    </div>
  );
}

