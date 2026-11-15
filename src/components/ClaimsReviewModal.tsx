'use client';

import React from 'react';
import { Claim } from '@/types';
import { updateClaimStatus } from '@/lib/itemService';
import { X, ShieldCheck } from 'lucide-react';
import ClaimReviewCard from './ClaimReviewCard';

interface ClaimsReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Claims on the current user's own items only – the parent filters. */
  claims: Claim[];
  onStatusChange?: () => void;
}

export default function ClaimsReviewModal({
  isOpen,
  onClose,
  claims,
  onStatusChange,
}: ClaimsReviewModalProps) {
  if (!isOpen) return null;

  const handleUpdate = (claimId: string, status: 'approved' | 'rejected', reason?: string) => {
    updateClaimStatus(claimId, status, reason);
    if (onStatusChange) onStatusChange();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col border border-gray-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-base">Claim Verification Inbox</h3>
              <p className="text-xs text-gray-500">Review 3 private proofs submitted by owners</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-6 space-y-4 flex-1">
          {claims.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-14 h-14 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-3">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <h4 className="text-sm font-bold text-gray-800">No Claim Submissions Yet</h4>
              <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                When a user submits 3 secret proofs to claim an item you reported, it will appear here for verification.
              </p>
            </div>
          ) : (
            claims.map((claim) => (
              <ClaimReviewCard key={claim.id} claim={claim} onUpdate={handleUpdate} />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gray-800 hover:bg-black text-white text-xs font-bold rounded-xl transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

