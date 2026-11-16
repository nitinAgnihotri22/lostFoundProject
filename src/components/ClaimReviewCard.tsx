'use client';

import React, { useState } from 'react';
import { Claim } from '@/types';
import { getRejectionReason, REJECTION_REASONS } from '@/lib/claims';
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
  const [rejecting, setRejecting] = useState(false);
  const [preset, setPreset] = useState<string>('');
  const [customReason, setCustomReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const reason = (preset === OTHER ? customReason : preset).trim();

  const submitRejection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) {
      setError('Please choose or write a reason so the claimant knows why.');
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
              <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Item Claimed:</span>
              <h4 className="font-bold text-gray-900 text-base">{claim.itemTitle}</h4>
            </>
          )}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-xs text-gray-500">
            <span>
              Submitted by: <strong>{claim.claimantName}</strong>
            </span>
            <span>&bull;</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(claim.createdAt).toLocaleDateString()}
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
          {claim.status}
        </span>
      </div>

      {/* 3 Verification Answers */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2.5 text-xs">
        <div className="font-bold text-gray-700 flex items-center gap-1.5 pb-1 border-b border-gray-200">
          <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
          <span>Claimant&apos;s 3 Secret Proofs:</span>
        </div>
        {[
          ['Proof 1 (Markings / Exterior):', claim.proof1],
          ['Proof 2 (Internal Contents / Attached):', claim.proof2],
          ['Proof 3 (Secret Verification / Lockscreen / Serial):', claim.proof3],
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
            <CheckCircle2 className="w-4 h-4" /> Claim Approved &mdash; Contact Information Unlocked:
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
          <MessageCircle className="w-4 h-4" /> Message {claim.claimantName.split(' ')[0]} about this claim
        </button>
      )}

      {/* Rejection reason shown to both poster and claimant */}
      {claim.status === 'rejected' && getRejectionReason(claim) && (
        <div className="p-3 bg-red-50 rounded-xl border border-red-200 text-xs text-red-900">
          <span className="font-bold">Rejection reason:</span> {getRejectionReason(claim)}
        </div>
      )}

      {/* Reject form – a reason is mandatory */}
      {claim.status === 'pending' && rejecting && (
        <form onSubmit={submitRejection} className="pt-3 border-t border-gray-100 space-y-3">
          <fieldset>
            <legend className="text-xs font-bold text-gray-800 mb-2">Why are you rejecting this claim?</legend>
            <div className="space-y-1.5">
              {[...REJECTION_REASONS, OTHER].map((r) => (
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
                  {r === OTHER ? 'Other (write your own)' : r}
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
              placeholder="Explain briefly why the proofs don't match…"
              className="w-full text-xs border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-400"
            />
          )}
          {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setRejecting(false);
                setError(null);
              }}
              className="px-4 py-2 text-xs font-bold text-gray-700 border border-gray-300 hover:bg-gray-50 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition flex items-center gap-1.5"
            >
              <XCircle className="w-4 h-4" />
              Confirm rejection
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
            Reject…
          </button>
          <button
            onClick={() => onUpdate(claim.id, 'approved')}
            className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            Approve & Release Contact
          </button>
        </div>
      )}
    </div>
  );
}
