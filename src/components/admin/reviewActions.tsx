'use client';
// Maker-checker approve / reject, shared by the Review queue and the Posts page.
import React, { useState } from 'react';
import { XCircle } from 'lucide-react';
import { adminApi, AdminApiError } from '@/lib/admin/client';
import { Button, Field, inputClass, Modal, useToast } from './ui';

export const REJECT_REASONS = [
  'Not enough detail to identify the item',
  'Photos missing, unclear or not of the item',
  'Contains personal information (phone, ID numbers, address)',
  'Prohibited or illegal item',
  'Spam, advertising or not a lost/found item',
  'Duplicate of another post',
  'Offensive or inappropriate content',
];

function RejectDialog({ count, busy, onCancel, onConfirm }: { count: number; busy: boolean; onCancel: () => void; onConfirm: (reason: string) => void }) {
  const [preset, setPreset] = useState(REJECT_REASONS[0]);
  const [custom, setCustom] = useState('');
  const reason = preset === 'other' ? custom.trim() : preset;
  return (
    <Modal
      title={count === 1 ? 'Reject this post' : `Reject ${count} posts`}
      onClose={onCancel}
      footer={
        <>
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant="danger" loading={busy} disabled={!reason} onClick={() => onConfirm(reason)}>
            <XCircle className="w-4 h-4" /> Reject
          </Button>
        </>
      }
    >
      <p className="text-sm text-slate-600 mb-4">
        The post stays off the website. The poster sees “Not approved” with the reason below in their profile, and can delete it and post again.
      </p>
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-slate-800 mb-2">Reason (shown to the poster)</legend>
        {[...REJECT_REASONS, 'other'].map((r) => (
          <label key={r} className="flex items-center gap-2 text-sm text-slate-800">
            <input type="radio" name="reject-reason" checked={preset === r} onChange={() => setPreset(r)} className="accent-slate-900" />
            {r === 'other' ? 'Other…' : r}
          </label>
        ))}
      </fieldset>
      {preset === 'other' && (
        <div className="mt-3">
          <Field label="Your reason" required>
            {(p) => <input {...p} value={custom} maxLength={300} onChange={(e) => setCustom(e.target.value)} className={inputClass} />}
          </Field>
        </div>
      )}
    </Modal>
  );
}

/** Returns approve(ids), reject(ids) (opens the reason dialog), the dialog element and a busy flag. */
export function useReviewActions(onDone: () => void) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [rejectIds, setRejectIds] = useState<string[] | null>(null);

  const send = async (ids: string[], action: 'approve' | 'reject', reason?: string) => {
    setBusy(true);
    try {
      const { changed, skipped } = await adminApi<{ changed: number; skipped: number }>('/posts', { method: 'PATCH', json: { ids, action, reason } });
      const n = `${changed} post${changed === 1 ? '' : 's'}`;
      toast(action === 'approve' ? `${n} approved – live on the website` : `${n} rejected`);
      if (skipped) toast(`${skipped} skipped – already reviewed by someone else`, 'error');
      setRejectIds(null);
      onDone();
    } catch (e) {
      toast(e instanceof AdminApiError ? e.message : 'Could not update', 'error');
    } finally {
      setBusy(false);
    }
  };

  return {
    busy,
    approve: (ids: string[]) => send(ids, 'approve'),
    reject: (ids: string[]) => setRejectIds(ids),
    dialog: rejectIds && <RejectDialog count={rejectIds.length} busy={busy} onCancel={() => setRejectIds(null)} onConfirm={(r) => send(rejectIds, 'reject', r)} />,
  };
}
