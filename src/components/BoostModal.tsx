'use client';
// Boost an item: pin it to the top and alert people nearby (free during launch).
// Shows the running boost's results instead when one is active or waiting for review.
import React, { useCallback, useEffect, useState } from 'react';
import { BellRing, CheckCircle2, Clock, Eye, Loader2, MessageCircle, Rocket, ShieldCheck, Users, X } from 'lucide-react';
import { api, ApiError, type BoostInfo } from '@/lib/api';
import { BOOST_PACKAGES, BOOST_PACKAGE_IDS, rupees, type BoostPackage } from '@/lib/plans';
import type { Boost, Item } from '@/types';
import { useI18n } from '@/i18n/LanguageProvider';
import type { TKey } from '@/i18n/translate';

export default function BoostModal({ item, onClose, onChanged }: { item: Item; onClose: () => void; onChanged?: () => void }) {
  const { t, formatDate } = useI18n();
  const [info, setInfo] = useState<BoostInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pkg, setPkg] = useState<BoostPackage>('area');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<'started' | 'pending' | null>(null);

  const load = useCallback(() => {
    api.boosts
      .forItem(item.id)
      .then((d) => {
        setInfo(d);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : t('boost.loadFailed')));
  }, [item.id, t]);

  useEffect(() => {
    load();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [load, onClose]);

  const running = info?.boosts.find((b) => b.status === 'active' || b.status === 'pending_review');
  const last = info?.boosts[0];
  const quotaLeft = info ? info.quota.limit - info.quota.used : 0;

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.boosts.start(item.id, pkg);
      setDone(r.needsReview ? 'pending' : 'started');
      onChanged?.();
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('common.somethingWrong'));
    } finally {
      setBusy(false);
    }
  };

  const stop = async (b: Boost) => {
    if (!confirm(t('boost.stopConfirm'))) return;
    setBusy(true);
    try {
      await api.boosts.stop(b.id);
      onChanged?.();
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.somethingWrong'));
    } finally {
      setBusy(false);
    }
  };

  const pinned = (p: BoostPackage) => {
    const h = BOOST_PACKAGES[p].durationHours;
    return h < 48 ? t('boost.pinnedHours', { hours: h }) : t('boost.pinnedDays', { days: h / 24 });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="boost-title"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[92vh] supports-[height:100dvh]:max-h-[92dvh] flex flex-col"
      >
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 bg-amber-50/60">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="p-2 bg-amber-500 text-white rounded-xl shadow shrink-0"><Rocket className="w-5 h-5" /></span>
            <div className="min-w-0">
              <h2 id="boost-title" className="text-lg font-black text-gray-900">{t('boost.title')}</h2>
              <p className="text-xs text-gray-600 truncate">{item.title}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label={t('common.close')} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-white rounded-full shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-5">
          {error && <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm font-semibold text-red-800">{error}</div>}
          {done && (
            <div role="status" className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm font-semibold text-emerald-900 flex gap-2">
              <CheckCircle2 className="w-5 h-5 shrink-0" /> {done === 'started' ? t('boost.started') : t('boost.pendingStarted')}
            </div>
          )}

          {!info && !error ? (
            <div className="flex justify-center py-12 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : !info ? null : running ? (
            <BoostStatus boost={running} busy={busy} onStop={() => stop(running)} />
          ) : (
            <>
              {last && <BoostStatus boost={last} busy={busy} />}
              <p className="text-sm text-gray-700">{t('boost.intro')}</p>
              {!info.paymentsEnabled && (
                <p className="text-sm font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">{t('boost.free')}</p>
              )}

              <fieldset>
                <legend className="sr-only">{t('boost.title')}</legend>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {BOOST_PACKAGE_IDS.map((p) => {
                    const pk = BOOST_PACKAGES[p];
                    const selected = pkg === p;
                    return (
                      <label
                        key={p}
                        className={`relative cursor-pointer rounded-2xl border-2 p-3 transition flex sm:flex-col gap-3 sm:gap-1 items-center sm:items-start ${selected ? 'border-amber-500 bg-amber-50' : 'border-gray-200 hover:border-gray-300'}`}
                      >
                        <input type="radio" name="boost-package" value={p} checked={selected} onChange={() => setPkg(p)} className="sr-only" />
                        <span className="flex-1 sm:flex-none">
                          <span className="block text-base font-black text-gray-900">{t(`boost.${p}` as TKey)}</span>
                          <span className="block text-xs text-gray-600">{t('boost.radius', { km: pk.radiusKm })}</span>
                          <span className="block text-xs text-gray-600">{pinned(p)}</span>
                          <span className="block text-xs text-gray-600">{pk.rounds === 1 ? t('boost.roundsOne') : t('boost.roundsMany', { count: pk.rounds })}</span>
                        </span>
                        <span className="text-right sm:text-left sm:mt-1">
                          {info.paymentsEnabled ? (
                            <span className="text-base font-black text-gray-900">{rupees(pk.pricePaise)}</span>
                          ) : (
                            <>
                              <s className="text-xs text-gray-400 mr-1">{rupees(pk.pricePaise)}</s>
                              <span className="text-sm font-black text-emerald-700">{t('boost.freeLabel')}</span>
                            </>
                          )}
                        </span>
                        {selected && <CheckCircle2 className="absolute top-2 right-2 w-4 h-4 text-amber-600 hidden sm:block" aria-hidden="true" />}
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <p className="flex items-start gap-2 text-sm text-gray-800 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
                <Users className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" aria-hidden="true" />
                {info.reach[pkg] > 0 ? t('boost.reach', { count: info.reach[pkg] }) : t('boost.reachNone')}
              </p>

              {info.textProblem && <p role="alert" className="text-sm font-semibold text-red-800 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{info.textProblem.message}</p>}

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">{t('boost.rulesTitle')}</h3>
                <ul className="space-y-1.5 text-xs text-gray-600">
                  {(['rule1', 'rule2', 'rule3'] as const).map((r) => (
                    <li key={r} className="flex gap-2"><ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />{t(`boost.${r}`)}</li>
                  ))}
                </ul>
              </div>
              <p className="text-xs text-gray-500">{t('boost.quota', { used: info.quota.used, limit: info.quota.limit })}</p>
              {!info.boosts.some((b) => b.status === 'active' || b.status === 'completed') && <p className="text-xs text-gray-500">{t('boost.firstReview')}</p>}
            </>
          )}
        </div>

        {info && !running && (
          <div className="p-4 sm:p-5 border-t border-gray-100 flex items-center justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-semibold text-sm hover:bg-gray-100">{t('common.close')}</button>
            <button
              onClick={start}
              disabled={busy || !!info.textProblem || quotaLeft <= 0}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm shadow disabled:opacity-50 inline-flex items-center gap-2"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
              {busy ? t('boost.starting') : last ? t('boost.boostAgain') : t('boost.start')}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  function BoostStatus({ boost, busy, onStop }: { boost: Boost; busy: boolean; onStop?: () => void }) {
    const label =
      boost.status === 'pending_review' ? t('boost.statusPending')
      : boost.status === 'active' ? t('boost.statusActive', { date: formatDate(boost.endsAt ?? boost.createdAt) })
      : boost.status === 'completed' ? t('boost.statusCompleted', { date: formatDate(boost.endsAt ?? boost.createdAt) })
      : boost.status === 'cancelled' ? t('boost.statusCancelled')
      : t('boost.statusRejected');
    const tone = boost.status === 'active' ? 'border-amber-200 bg-amber-50' : boost.status === 'rejected' ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50';
    return (
      <div className={`rounded-2xl border p-4 ${tone}`}>
        <p className="font-bold text-gray-900 flex items-center gap-2">
          {boost.status === 'pending_review' ? <Clock className="w-4 h-4 text-amber-600" /> : <Rocket className="w-4 h-4 text-amber-600" />}
          {t(`boost.${boost.package}` as TKey)} · {label}
        </p>
        {boost.status === 'rejected' && boost.reviewNote && <p className="mt-1 text-sm text-red-800"><strong>{t('boost.reason')}</strong> {boost.reviewNote}</p>}
        {boost.startsAt && (
          <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[
              { icon: BellRing, label: t('boost.alerted'), value: boost.recipientsCount },
              { icon: Eye, label: t('boost.views'), value: boost.viewsCount },
              { icon: MessageCircle, label: t('boost.chats'), value: boost.messagesCount ?? 0 },
            ].map(({ icon: Icon, label: l, value }) => (
              <div key={l} className="bg-white rounded-xl border border-gray-100 p-2">
                <Icon className="w-4 h-4 mx-auto text-gray-400" aria-hidden="true" />
                <dd className="text-lg font-black text-gray-900 tabular-nums">{value}</dd>
                <dt className="text-[0.6875rem] text-gray-500">{l}</dt>
              </div>
            ))}
          </dl>
        )}
        {onStop && (
          <button onClick={onStop} disabled={busy} className="mt-3 px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-xs font-bold text-gray-700 hover:text-red-700 hover:border-red-200 disabled:opacity-50">
            {t('boost.stop')}
          </button>
        )}
      </div>
    );
  }
}
