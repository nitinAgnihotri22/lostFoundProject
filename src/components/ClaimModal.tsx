'use client';

import React, { useState } from 'react';
import { Item, User } from '@/types';
import { api, ApiError } from '@/lib/api';
import { ALREADY_CLAIMED_ERROR } from '@/lib/claims';
import { isOwnItem, OWN_ITEM_CLAIM_ERROR } from '@/lib/ownership';
import { X, ShieldAlert, CheckCircle, HelpCircle, Lock } from 'lucide-react';

interface ClaimModalProps {
  item: Item | null;
  currentUser: User | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ClaimModal({ item, currentUser, onClose, onSuccess }: ClaimModalProps) {
  const [proof1, setProof1] = useState('');
  const [proof2, setProof2] = useState('');
  const [proof3, setProof3] = useState('');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!item) return null;

  const questions = item.verificationQuestions || [
    'What unique marking, scratch, or distinct physical feature does it have?',
    'What is inside or hidden (e.g. cards, stickers, specific engraving, internal tags)?',
    'What secret information or verification detail can you provide (e.g., lock screen photo, serial number digits, custom keychain)?'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      alert('Please sign in to claim an item.');
      onClose();
      return;
    }
    if (!proof1.trim() || !proof2.trim() || !proof3.trim()) {
      alert('You must provide answers to all 3 verification points to claim this item.');
      return;
    }
    if (isOwnItem(item, currentUser)) {
      alert(OWN_ITEM_CLAIM_ERROR);
      onClose();
      return;
    }
    if (item.myClaim) {
      alert(ALREADY_CLAIMED_ERROR);
      onClose();
      return;
    }

    setSubmitting(true);
    try {
      await api.claims.create({ itemId: item.id, proof1: proof1.trim(), proof2: proof2.trim(), proof3: proof3.trim(), phone: phone.trim() || undefined });
      setSubmitted(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not submit your claim.';
      alert(msg);
      // These states can't be fixed by editing the form – close it.
      if (err instanceof ApiError && ['ALREADY_CLAIMED', 'OWN_ITEM', 'ITEM_CLOSED', 'NOT_CLAIMABLE'].includes(err.code ?? '')) {
        onSuccess();
        onClose();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden my-auto border border-gray-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-blue-50/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-600 text-white rounded-xl shadow">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-base">Claim Item Verification</h3>
              <p className="text-xs text-gray-500">Provide 3 private proofs that only the true owner knows</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {submitted ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle className="w-10 h-10" />
            </div>
            <h4 className="text-xl font-bold text-gray-900">Claim Submitted for Review!</h4>
            <p className="text-sm text-gray-600 max-w-md mx-auto">
              Your 3 verification proofs have been forwarded to the finder ({item.userName}). If your answers match, you will receive an instant notification and handover instructions.
            </p>
            <div className="inline-block bg-blue-50 text-blue-700 text-xs font-semibold px-4 py-2 rounded-full border border-blue-100">
              Status: Pending Finder Verification
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Context preview */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100 text-xs text-gray-700">
              {item.images[0] && (
                <img
                  src={item.images[0]}
                  alt="thumbnail"
                  className="w-12 h-12 rounded-lg object-cover border border-gray-200"
                />
              )}
              <div className="truncate">
                <span className="font-bold block text-gray-900">{item.title}</span>
                <span className="text-gray-500">Found at: {item.location.address}</span>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 text-amber-900 text-xs p-3.5 rounded-xl flex items-start gap-2">
              <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong>Owner Protection Protocol:</strong> To prevent fraudulent claims, describe 3 specific traits that are NOT visible in the public photos.
              </div>
            </div>

            {/* Proof 1 */}
            <div>
              <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">1</span>
                {questions[0]}
              </label>
              <textarea
                required
                rows={2}
                value={proof1}
                onChange={(e) => setProof1(e.target.value)}
                placeholder="e.g. Scratched bottom left corner, sticker of a mountain on the back..."
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>

            {/* Proof 2 */}
            <div>
              <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">2</span>
                {questions[1]}
              </label>
              <textarea
                required
                rows={2}
                value={proof2}
                onChange={(e) => setProof2(e.target.value)}
                placeholder="e.g. Driving license with name 'J. Smith', red gym card in the side slot..."
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>

            {/* Proof 3 */}
            <div>
              <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">3</span>
                {questions[2]}
              </label>
              <textarea
                required
                rows={2}
                value={proof3}
                onChange={(e) => setProof3(e.target.value)}
                placeholder="e.g. Lock screen picture is a black cat, last 4 digits of IMEI are 4921..."
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>

            {/* Contact Phone */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Your Contact Phone Number (Shared only after finder approval):
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
                className="w-full text-sm px-3.5 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md transition disabled:opacity-50"
              >
                {submitting ? 'Submitting Proofs...' : 'Submit 3 Proofs & Claim'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

