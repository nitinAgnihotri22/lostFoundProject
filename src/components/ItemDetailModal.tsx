'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Item, ItemDetail, User as AppUser } from '@/types';
import { api, ApiError } from '@/lib/api';
import { getRejectionReason } from '@/lib/claims';
import { useI18n } from '@/i18n/LanguageProvider';
import type { TKey } from '@/i18n/translate';
import {
  X, MapPin, Calendar, User, ShieldCheck, Share2, ChevronLeft, ChevronRight, Printer, Users,
  MessageCircle, CheckCircle2, Trash2, RotateCcw, Mail, Phone, Loader2, Lock,
} from 'lucide-react';
import PrintFlyerModal from './PrintFlyerModal';
import ClaimReviewCard from './ClaimReviewCard';
import AdSlot from './ads/AdSlot';
import { track } from '@/lib/track';

interface ItemDetailModalProps {
  item: Item | null;
  currentUser?: AppUser | null;
  onClose: () => void;
  /** Open the 3-proof claim form. */
  onClaim: (item: Item) => void;
  /** Something changed (claim reviewed, item closed/deleted) – parent should refresh its lists. */
  onChanged?: () => void;
  /** Open the chat panel on this conversation. */
  onMessage?: (conversationId: string) => void;
  /** A guest tried to do something that needs an account. */
  onRequireLogin?: (message: string) => void;
  /** Show the item-details ad (public home page only, never on profile pages). */
  showAd?: boolean;
}

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1584824486509-112e4181ff6b?w=800&auto=format&fit=crop&q=80';

const STATUS_BANNER: Record<Item['status'], { text: TKey; className: string } | null> = {
  active: null,
  claimed: { text: 'item.bannerClaimed', className: 'bg-blue-50 border-blue-200 text-blue-900' },
  resolved: { text: 'item.bannerResolved', className: 'bg-gray-100 border-gray-200 text-gray-700' },
};

const STATUS_LABEL: Record<Item['status'], TKey> = {
  active: 'common.statusActive',
  claimed: 'common.statusClaimed',
  resolved: 'common.statusResolved',
};

export default function ItemDetailModal({ item: initialItem, currentUser, onClose, onClaim, onChanged, onMessage, onRequireLogin, showAd = false }: ItemDetailModalProps) {
  const { t, lang, formatDate } = useI18n();
  const [detail, setDetail] = useState<ItemDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [copied, setCopied] = useState(false);
  const [showFlyerModal, setShowFlyerModal] = useState(false);
  const [busy, setBusy] = useState(false);

  const itemId = initialItem?.id;

  const load = useCallback(async () => {
    if (!itemId) return;
    try {
      setDetail(await api.items.get(itemId, true));
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof ApiError && e.status === 404 ? 'item.unavailable' : (e as Error).message);
    }
  }, [itemId]);

  useEffect(() => {
    load();
  }, [load]);

  // Analytics: someone other than the poster opened this item.
  const viewerId = currentUser?.id;
  const posterId = initialItem?.userId;
  const category = initialItem?.category;
  useEffect(() => {
    if (itemId && viewerId !== posterId) track('item_view', { category: category ?? null });
  }, [itemId, viewerId, posterId, category]);

  if (!initialItem) return null;

  // Show the list copy immediately; swap in the full detail once it arrives.
  const item: Item = detail ?? initialItem;
  const role = detail?.viewerRole ?? (currentUser ? (currentUser.id === item.userId ? 'owner' : 'visitor') : 'guest');
  const isOwner = role === 'owner';
  const isFound = item.type === 'found';
  const isActive = item.status === 'active';
  const claims = detail?.claims ?? [];
  const claimCount = detail?.claimCount ?? item.claimCount ?? 0;
  const pendingCount = claims.filter((c) => c.status === 'pending').length;
  const myClaim = detail ? detail.myClaim : item.myClaim;
  const images = item.images && item.images.length > 0 ? item.images : [FALLBACK_IMAGE];
  const banner = STATUS_BANNER[item.status];

  const formattedDate = new Date(item.occurredAt).toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-IN', { dateStyle: 'full', timeStyle: 'short' });

  const requireLogin = (msg: string) => onRequireLogin?.(msg);

  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      alert(e instanceof Error ? e.message : t('common.somethingWrong'));
    } finally {
      setBusy(false);
    }
  };

  const handleClaimUpdate = (claimId: string, status: 'approved' | 'rejected', reason?: string) =>
    run(async () => {
      const { autoRejected } = await api.claims.review(claimId, status, reason);
      await load();
      onChanged?.();
      if (status === 'approved') {
        alert(t('item.approvedAlert') + (autoRejected ? ` ${t('item.autoRejected', { count: autoRejected })}` : ''));
      }
    });

  const openChat = (recipientId?: string) =>
    run(async () => {
      if (!currentUser) return requireLogin(t('item.signInMessage'));
      const conv = await api.chat.start({ itemId: item.id, recipientId });
      onMessage?.(conv.id);
    });

  const closeReport = () =>
    run(async () => {
      if (!confirm(isFound ? t('item.confirmReturned') : t('item.confirmFound'))) return;
      await api.items.setStatus(item.id, 'resolved');
      await load();
      onChanged?.();
    });

  const reopenReport = () =>
    run(async () => {
      await api.items.setStatus(item.id, 'active');
      await load();
      onChanged?.();
    });

  const deleteReport = () =>
    run(async () => {
      if (!confirm(t('item.confirmDelete'))) return;
      await api.items.remove(item.id);
      onChanged?.();
      onClose();
    });

  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? `${window.location.origin}/?item=${encodeURIComponent(item.id)}` : '';
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: item.title, text: t('item.shareText', { title: item.title }), url });
        return;
      } catch {
        // fall through to clipboard
      }
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      prompt(t('item.copyPrompt'), url);
    }
  };

  // ---- footer primary action -------------------------------------------------
  const renderPrimaryAction = () => {
    if (isOwner) {
      return (
        <span className="px-5 py-2.5 rounded-xl bg-gray-100 text-gray-500 font-semibold text-sm flex items-center gap-2 cursor-default">
          <User className="w-4 h-4" /> {t('item.youPosted')}
        </span>
      );
    }
    if (myClaim) {
      const tone =
        myClaim.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : myClaim.status === 'rejected' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700';
      return <span className={`px-5 py-2.5 rounded-xl font-semibold text-sm cursor-default ${tone}`}>{t(`claimStatus.${myClaim.status}`)}</span>;
    }
    if (!isActive) {
      return <span className="px-5 py-2.5 rounded-xl bg-gray-100 text-gray-500 font-semibold text-sm cursor-default">{item.status === 'claimed' ? t('item.alreadyClaimed') : t('item.reportClosed')}</span>;
    }
    if (isFound) {
      return (
        <button
          onClick={() => {
            if (!currentUser) return requireLogin(t('home.signInClaim', { title: item.title }));
            onClose();
            onClaim(item);
          }}
          className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md hover:shadow-lg transition flex items-center gap-2"
        >
          <ShieldCheck className="w-4 h-4" /> {t('item.claimThis')}
        </button>
      );
    }
    return (
      <button
        onClick={() => openChat()}
        disabled={busy}
        className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm shadow-md hover:shadow-lg transition flex items-center gap-2 disabled:opacity-60"
      >
        <MessageCircle className="w-4 h-4" /> {t('item.foundMessageOwner')}
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div role="dialog" aria-modal="true" aria-labelledby="item-title" className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[92vh] supports-[height:100dvh]:max-h-[92dvh] flex flex-col">
        {/* Header Bar */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${isFound ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
              {isFound ? t('item.foundReport') : t('item.lostNotice')}
            </span>
            <span className="text-xs font-semibold text-gray-600 bg-gray-200/70 px-2.5 py-1 rounded-md">{t(`categories.${item.category}`)}</span>
            {!isActive && (
              <span className="text-xs font-bold uppercase tracking-wider bg-gray-800 text-white px-2.5 py-1 rounded-md">{t(STATUS_LABEL[item.status])}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowFlyerModal(true)} className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-full transition flex items-center gap-1 text-xs font-semibold" title={t('item.flyerTitle')} aria-label={t('item.flyerTitle')}>
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline" aria-hidden="true">{t('item.flyer')}</span>
            </button>
            <button onClick={handleShare} className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-full transition" title={t('item.share')} aria-label={t('item.share')}>
              <Share2 className="w-5 h-5" />
            </button>
            <button onClick={onClose} className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-full transition" aria-label={t('common.close')}>
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Modal Content */}
        <div className="overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-5 sm:space-y-6 flex-1">
          {loadError && <div role="alert" className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800 font-semibold">{loadError === 'item.unavailable' ? t('item.unavailable') : loadError}</div>}
          {banner && <div className={`p-3 rounded-xl border text-sm font-semibold ${banner.className}`}>{t(banner.text)}</div>}

          {/* Image Gallery */}
          <div className="relative rounded-2xl overflow-hidden bg-gray-900 aspect-[16/10] max-h-[380px] shadow-inner">
            <img src={images[activeImageIdx] ?? images[0]} alt={item.title} className="w-full h-full object-contain mx-auto" />
            {images.length > 1 && (
              <>
                <button onClick={() => setActiveImageIdx((p) => (p > 0 ? p - 1 : images.length - 1))} className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white p-2 rounded-full backdrop-blur-sm transition" aria-label={t('item.prevPhoto')}>
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button onClick={() => setActiveImageIdx((p) => (p < images.length - 1 ? p + 1 : 0))} className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white p-2 rounded-full backdrop-blur-sm transition" aria-label={t('item.nextPhoto')}>
                  <ChevronRight className="w-5 h-5" />
                </button>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 bg-black/50 p-1.5 rounded-xl backdrop-blur-md">
                  {images.map((img, idx) => (
                    <button key={idx} onClick={() => setActiveImageIdx(idx)} aria-label={t('item.photoN', { n: idx + 1 })} aria-current={activeImageIdx === idx} className={`w-12 h-10 rounded-lg overflow-hidden border-2 transition ${activeImageIdx === idx ? 'border-blue-500 scale-105' : 'border-transparent opacity-60'}`}>
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Maker-checker: the poster sees why their post isn't public yet. */}
          {isOwner && (detail ?? item).reviewStatus === 'pending' && (
            <div role="status" className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <p className="font-bold">{t('item.reviewPendingTitle')}</p>
              <p className="mt-0.5">{t('item.reviewPendingBody')}</p>
            </div>
          )}
          {isOwner && (detail ?? item).reviewStatus === 'rejected' && (
            <div role="status" className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
              <p className="font-bold">{t('item.reviewRejectedTitle')}</p>
              <p className="mt-0.5">{t('item.reviewRejectedBody', { reason: (detail ?? item).reviewNote || '—' })}</p>
            </div>
          )}

          {/* Title & Metadata */}
          <div>
            <h2 id="item-title" className="text-2xl font-bold text-gray-900 leading-snug">{item.title}</h2>
            <div className={`mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${claimCount > 0 ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
              <Users className="w-3.5 h-3.5" />
              {!detail && !loadError ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : claimCount === 0 ? (
                t('item.noClaims')
              ) : claimCount === 1 ? (
                t('item.claimsOne')
              ) : (
                t('item.claimsMany', { count: claimCount })
              )}
              {isOwner && pendingCount > 0 && <span className="ml-1 bg-red-500 text-white text-[0.625rem] px-1.5 rounded-full">{t('item.pendingN', { count: pendingCount })}</span>}
            </div>

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-600 bg-blue-50/50 p-3.5 rounded-xl border border-blue-100">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-gray-800">{t('item.location')}</div>
                  <div className="text-xs text-gray-600">{item.location.address}</div>
                  <div className="text-[0.6875rem] font-mono text-gray-400">{t('item.coords', { lat: item.location.lat.toFixed(5), lng: item.location.lng.toFixed(5) })}</div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Calendar className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-gray-800">{isFound ? t('item.whenFound') : t('item.whenLost')}</div>
                  <div className="text-xs text-gray-600">{formattedDate}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Viewer's own claim status */}
          {myClaim && (
            <div className={`p-4 rounded-xl border text-sm ${myClaim.status === 'approved' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : myClaim.status === 'rejected' ? 'bg-red-50 border-red-200 text-red-900' : 'bg-amber-50 border-amber-200 text-amber-900'}`}>
              <div className="font-bold">
                {myClaim.status === 'pending' && t('item.myPending')}
                {myClaim.status === 'approved' && t('item.myApproved')}
                {myClaim.status === 'rejected' && t('item.myRejected')}
              </div>
              {myClaim.status === 'rejected' && (
                <div className="mt-1 text-xs">
                  <span className="font-semibold">{t('item.reasonFromPoster')}</span> {getRejectionReason(myClaim) || t('item.noReason')}
                </div>
              )}
              <div className="mt-1 text-xs opacity-80">{t('item.submittedOn', { date: formatDate(myClaim.createdAt) })}</div>

              {detail?.posterContact && (
                <div className="mt-3 p-3 bg-white rounded-lg border border-emerald-200 text-xs text-gray-800 space-y-1">
                  <div className="font-bold text-emerald-800 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> {t('item.contactUnlocked')}
                  </div>
                  <div className="font-semibold">{detail.posterContact.name}</div>
                  {detail.posterContact.email && (
                    <a href={`mailto:${detail.posterContact.email}`} className="flex items-center gap-1.5 hover:underline">
                      <Mail className="w-3.5 h-3.5" /> {detail.posterContact.email}
                    </a>
                  )}
                  {detail.posterContact.phone && (
                    <a href={`tel:${detail.posterContact.phone}`} className="flex items-center gap-1.5 hover:underline">
                      <Phone className="w-3.5 h-3.5" /> {detail.posterContact.phone}
                    </a>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Full Description */}
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-2">{t('item.description')}</h2>
            <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line bg-gray-50 p-4 rounded-xl border border-gray-100">{item.description}</div>
          </div>

          {/* Verification questions (found items) */}
          {isFound && item.verificationQuestions && (
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" /> {t('item.questions')}
              </h2>
              <ol className="text-sm text-gray-700 bg-amber-50/60 border border-amber-100 rounded-xl p-4 space-y-1.5 list-decimal list-inside">
                {item.verificationQuestions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ol>
              <p className="text-[0.6875rem] text-gray-500 mt-1.5">{t('item.questionsNote')}</p>
            </div>
          )}

          {/* Reporter card */}
          <div className="border border-emerald-100 bg-emerald-50/60 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div aria-hidden="true" className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-base shadow">{item.userName ? item.userName[0] : 'U'}</div>
              <div>
                <div className="text-xs text-gray-500 font-medium">{t('item.reportedBy')}</div>
                <div className="text-sm font-bold text-gray-800">{item.userName}</div>
                <div className="text-xs text-emerald-700 font-medium flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> {t('item.verifiedMember')}
                </div>
              </div>
            </div>
            {isOwner ? (
              <div className="text-xs text-gray-600 max-w-xs">
                {t('item.ownerPrivacy')}
              </div>
            ) : (
              <div className="flex flex-col items-start sm:items-end gap-2">
                <div className="text-xs text-gray-600 max-w-xs">
                  <span className="font-semibold text-gray-800">{t('item.securityRule')}</span> {t('item.securityRuleText')}
                </div>
                <button
                  onClick={() => openChat()}
                  disabled={busy}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100 transition flex items-center gap-1.5 disabled:opacity-60"
                >
                  <MessageCircle className="w-4 h-4" /> {t('item.messageName', { name: item.userName.split(' ')[0] })}
                </button>
              </div>
            )}
          </div>

          {/* Ad: public view only – never for the poster or someone who claimed it */}
          {showAd && !isOwner && !myClaim && <AdSlot slot="itemDetail" kind="responsive" className="pt-2" />}

          {/* Claims received – full list only for the person who posted the item */}
          {isOwner && (
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-2">{t('item.claimsReceived', { count: claimCount })}</h2>
              {!detail ? (
                <div className="text-xs text-gray-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> {t('item.loadingClaims')}</div>
              ) : claims.length === 0 ? (
                <div className="text-xs text-gray-500 bg-gray-50 p-4 rounded-xl border border-dashed border-gray-200 text-center">
                  {t('item.noClaimsYet')}
                </div>
              ) : (
                <div className="space-y-3">
                  {!isActive && pendingCount === 0 && (
                    <p className="text-xs text-gray-500">{t('item.readOnly')}</p>
                  )}
                  {claims.map((claim) => (
                    <ClaimReviewCard
                      key={claim.id}
                      claim={claim}
                      showItemTitle={false}
                      onUpdate={handleClaimUpdate}
                      onMessage={(c) => openChat(c.claimantId)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Owner tools */}
          {isOwner && (
            <div className="border-t border-gray-100 pt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500 mr-auto">{t('item.manage')}</span>
              {isActive && (
                <button onClick={closeReport} disabled={busy} className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition flex items-center gap-1.5 disabled:opacity-60">
                  <CheckCircle2 className="w-4 h-4" /> {isFound ? t('item.markReturned') : t('item.markFound')}
                </button>
              )}
              {item.status === 'resolved' && (
                <button onClick={reopenReport} disabled={busy} className="px-3.5 py-2 rounded-xl text-xs font-bold bg-gray-50 text-gray-800 border border-gray-200 hover:bg-gray-100 transition flex items-center gap-1.5 disabled:opacity-60">
                  <RotateCcw className="w-4 h-4" /> {t('item.reopen')}
                </button>
              )}
              <button onClick={deleteReport} disabled={busy} className="px-3.5 py-2 rounded-xl text-xs font-bold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition flex items-center gap-1.5 disabled:opacity-60">
                <Trash2 className="w-4 h-4" /> {t('common.delete')}
              </button>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-gray-100 bg-white flex items-center justify-between gap-3">
          {copied && <span role="status" className="text-xs text-green-700 font-semibold">{t('item.linkCopied')}</span>}
          <div className="flex items-center gap-3 ml-auto">
            <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-semibold text-sm hover:bg-gray-100 transition">
              {t('common.close')}
            </button>
            {renderPrimaryAction()}
          </div>
        </div>
      </div>

      {showFlyerModal && <PrintFlyerModal item={item} onClose={() => setShowFlyerModal(false)} />}
    </div>
  );
}
