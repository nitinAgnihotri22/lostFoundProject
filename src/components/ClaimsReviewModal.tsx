'use client';

import React from 'react';
import { Claim } from '@/types';
import { X, ShieldCheck } from 'lucide-react';
import ClaimReviewCard from './ClaimReviewCard';
import { useI18n } from '@/i18n/LanguageProvider';

interface ClaimsReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Claims on the current user's own items only – the parent filters. */
  claims: Claim[];
  /** Approve/reject through the API; the parent refreshes afterwards. */
  onUpdate: (claimId: string, status: 'approved' | 'rejected', reason?: string) => void | Promise<void>;
  onMessage?: (claim: Claim) => void;
}

export default function ClaimsReviewModal({
  isOpen,
  onClose,
  claims,
  onUpdate,
  onMessage,
}: ClaimsReviewModalProps) {
  const { t } = useI18n();
  if (!isOpen) return null;

  const handleUpdate = (claimId: string, status: 'approved' | 'rejected', reason?: string) => {
    void onUpdate(claimId, status, reason);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div role="dialog" aria-modal="true" aria-labelledby="inbox-title" className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[90vh] supports-[height:100dvh]:max-h-[90dvh] flex flex-col border border-gray-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 id="inbox-title" className="font-bold text-gray-900 text-base">{t('review.inboxTitle')}</h2>
              <p className="text-xs text-gray-500">{t('review.inboxSubtitle')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t('common.close')}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4 flex-1">
          {claims.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-14 h-14 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-3">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <h3 className="text-sm font-bold text-gray-800">{t('review.inboxEmpty')}</h3>
              <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                {t('review.inboxEmptyBody')}
              </p>
            </div>
          ) : (
            claims.map((claim) => (
              <ClaimReviewCard key={claim.id} claim={claim} onUpdate={handleUpdate} onMessage={onMessage} />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gray-800 hover:bg-black text-white text-xs font-bold rounded-xl transition"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
}

