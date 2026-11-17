'use client';

import React, { useState } from 'react';
import { Claim } from '@/types';
import { getRejectionReason } from '@/lib/claims';
import { useI18n } from '@/i18n/LanguageProvider';
import { CheckCircle2, XCircle, Phone, Mail, Clock, HelpCircle, MessageCircle } from 'lucide-react';

const OTHER = '__other__';

interface ClaimReviewCardProps {
  claim: Claim;
  /** Show the claimed item's title (inbox view). Hidden inside the item popup. */
  showItemTitle?: boolean;
  /** `reason` is required when rejecting. */
  onUpdate: (claimId: string, status: 'approved' | 'rejected', reason?: string) => void;
  /** Open an in-app chat with the claimant. */
  onMessage?: (claim: Claim) => void;
}

/** One claim with its 3 proofs and approve/reject actions – visible only to the item's poster. */
export default function ClaimReviewCard({ claim, showItemTitle = true, onUpdate, onMessage }: ClaimReviewCardProps) {
  const { t, formatDate } = useI18n();
  const [rejecting, setRejecting] = useState(false);
  // Preset reasons are saved in the reviewer's language – the claimant sees exactly what the reviewer chose.
  const presetReasons = [t('review.reason1'), t('review.reason2'), t('review.reason3'), t('review.reason4')];
  const [preset, setPreset] = useState<string>('');
  const [customReason, setCustomReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const reason = (preset === OTHER ? customReason : preset).trim();

  const submitRejection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) {
      setError(t('review.needReason'));
      return;
    }
    onUpdate(claim.id, 'rejected', reason);
    setRejecting(false);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 shadow-xs hover:border-gray-300 transition space-y-4">
      {/* Item & Claimant Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {showItemTitle && (
            <>
              <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">{t('review.itemClaimed')}</span>
              <h4 className="font-bold text-gray-900 text-base">{claim.itemTitle}</h4>
            </>
          )}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-xs text-gray-500">
            <span>
              {t('review.submittedBy')} <strong>{claim.claimantName}</strong>
            </span>
            <span>&bull;</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDate(claim.createdAt)}
            </span>
          </div>
        </div>

        <span
          className={`shrink-0 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
            claim.status === 'approved'
              ? 'bg-emerald-100 text-emerald-800'
              : claim.status === 'rejected'
              ? 'bg-red-100 text-red-800'
              : 'bg-amber-100 text-amber-800'
          }`}
        >
          {t(`common.claim${claim.status === 'pending' ? 'Pending' : claim.status === 'approved' ? 'Approved' : 'Rejected'}`)}
        </span>
      </div>

      {/* 3 Verification Answers */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2.5 text-xs">
        <div className="font-bold text-gray-700 flex items-center gap-1.5 pb-1 border-b border-gray-200">
          <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
          <span>{t('review.proofsHeading')}</span>
        </div>
        {[
          [t('review.proof1'), claim.proof1],
          [t('review.proof2'), claim.proof2],
          [t('review.proof3'), claim.proof3],
        ].map(([label, value]) => (
          <div key={label}>
            <span className="font-semibold text-gray-800 block">{label}</span>
            <p className="text-gray-600 bg-white p-2 rounded-lg border border-gray-200 mt-0.5 break-words">{value}</p>
          </div>
        ))}
      </div>

      {/* Contact details revealed if approved */}
      {claim.status === 'approved' && (
        <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900 space-y-1">
          <div className="font-bold flex items-center gap-1.5 text-emerald-800">
            <CheckCircle2 className="w-4 h-4" /> {t('review.approvedUnlocked')}
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            {claim.claimantPhone && (
              <span className="flex items-center gap-1 font-mono font-medium">
                <Phone className="w-3.5 h-3.5" /> {claim.claimantPhone}
              </span>
            )}
            <span className="flex items-center gap-1 font-medium break-all">
              <Mail className="w-3.5 h-3.5" /> {claim.claimantEmail}
            </span>
          </div>
        </div>
      )}

      {onMessage && (
        <button
          type="button"
          onClick={() => onMessage(claim)}
          className="text-xs font-bold text-blue-700 hover:underline flex items-center gap-1.5"
        >
          <MessageCircle className="w-4 h-4" /> {t('review.messageAbout', { name: claim.claimantName.split(' ')[0] })}
        </button>
      )}

      {/* Rejection reason shown to both poster and claimant */}
      {claim.status === 'rejected' && getRejectionReason(claim) && (
        <div className="p-3 bg-red-50 rounded-xl border border-red-200 text-xs text-red-900">
          <span className="font-bold">{t('review.rejectionReason')}</span> {getRejectionReason(claim)}
        </div>
      )}

      {/* Reject form – a reason is mandatory */}
      {claim.status === 'pending' && rejecting && (
        <form onSubmit={submitRejection} className="pt-3 border-t border-gray-100 space-y-3">
          <fieldset>
            <legend className="text-xs font-bold text-gray-800 mb-2">{t('review.whyReject')}</legend>
            <div className="space-y-1.5">
              {[...presetReasons, OTHER].map((r) => (
                <label
                  key={r}
                  className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg border cursor-pointer transition ${
                    preset === r ? 'border-red-300 bg-red-50 text-red-900' : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <input
                    type="radio"
                    name={`reject-reason-${claim.id}`}
                    value={r}
                    checked={preset === r}
                    onChange={() => {
                      setPreset(r);
                      setError(null);
                    }}
                    className="accent-red-600"
                  />
                  {r === OTHER ? t('review.other') : r}
                </label>
              ))}
            </div>
          </fieldset>
          {preset === OTHER && (
            <textarea
              autoFocus
              value={customReason}
              onChange={(e) => {
                setCustomReason(e.target.value);
                setError(null);
              }}
              maxLength={300}
              rows={3}
              placeholder={t('review.otherPlaceholder')}
              aria-label={t('review.other')}
              className="w-full text-xs border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-400"
            />
          )}
          {error && <p role="alert" className="text-xs font-semibold text-red-600">{error}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setRejecting(false);
                setError(null);
              }}
              className="px-4 py-2 text-xs font-bold text-gray-700 border border-gray-300 hover:bg-gray-50 rounded-xl transition"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition flex items-center gap-1.5"
            >
              <XCircle className="w-4 h-4" />
              {t('review.confirmReject')}
            </button>
          </div>
        </form>
      )}

      {/* Action Buttons if Pending */}
      {claim.status === 'pending' && !rejecting && (
        <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-gray-100">
          <button
            onClick={() => setRejecting(true)}
            className="px-4 py-2 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 rounded-xl transition flex items-center gap-1.5"
          >
            <XCircle className="w-4 h-4" />
            {t('review.reject')}
          </button>
          <button
            onClick={() => onUpdate(claim.id, 'approved')}
            className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            {t('review.approve')}
          </button>
        </div>
      )}
    </div>
  );
}
