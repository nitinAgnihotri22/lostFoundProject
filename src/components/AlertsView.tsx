'use client';
// /alerts – Premium plan, match alerts (saved searches), possible matches and notification settings.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, BellRing, Check, Crown, Loader2, MapPin, Navigation, Pause, Pencil, Play, Plus, Search, Sparkles, Trash2, X,
} from 'lucide-react';
import { api, ApiError, UNAUTHORIZED_EVENT, type AlertsData, type PrefsData, type SavedSearchInput } from '@/lib/api';
import { fetchCurrentUser } from '@/lib/authClient';
import { getStoredUser, setStoredUser } from '@/lib/itemService';
import { getCurrentPosition, reverseGeocodePlace, searchPlaces, type PlaceResult } from '@/lib/geo';
import { CATEGORIES } from '@/lib/validation';
import { ALERT_RADII, PLAN_LIMITS, PREMIUM_PRICES, rupees } from '@/lib/plans';
import { pushState, subscribePush, unsubscribePush, type PushState } from '@/lib/push';
import type { GeoLocation, SavedSearch, User } from '@/types';
import { useI18n } from '@/i18n/LanguageProvider';
import type { TKey } from '@/i18n/translate';
import AuthModal from './AuthModal';
import LanguageSwitcher from './LanguageSwitcher';
import NotificationBell from './NotificationBell';

const card = 'bg-white rounded-3xl border border-gray-200 shadow-sm p-4 sm:p-6';
const input = 'w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white';
const btnPrimary = 'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold disabled:opacity-50';
const btnSecondary = 'inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-gray-300 bg-white text-gray-700 text-xs font-bold hover:bg-gray-50 disabled:opacity-50';

function Toggle({ id, checked, onChange, label, desc, disabled }: { id: string; checked: boolean; onChange: (v: boolean) => void; label: string; desc?: string; disabled?: boolean }) {
  return (
    <label htmlFor={id} className="flex items-start justify-between gap-4 py-3">
      <span>
        <span className="block text-sm font-bold text-gray-900">{label}</span>
        {desc && <span className="block text-xs text-gray-600 mt-0.5">{desc}</span>}
      </span>
      <input id={id} type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="mt-1 w-5 h-5 accent-blue-600 shrink-0 disabled:opacity-50" />
    </label>
  );
}

/** Place search + "use my current location". */
function PlaceField({ id, value, onChange }: { id: string; value: GeoLocation | null; onChange: (v: GeoLocation | null) => void }) {
  const { t } = useI18n();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    setBusy(true);
    const timer = setTimeout(() => {
      searchPlaces(q.trim(), ctrl.signal).then(setResults).catch(() => {}).finally(() => !ctrl.signal.aborted && setBusy(false));
    }, 350);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [q]);

  const useGps = async () => {
    setLocating(true);
    try {
      const pos = await getCurrentPosition();
      onChange(await reverseGeocodePlace(pos.lat, pos.lng));
    } catch {
      alert(t('errors.gpsFailed'));
    } finally {
      setLocating(false);
    }
  };

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 border border-gray-300 rounded-xl px-3 py-2 bg-gray-50">
        <span className="flex items-center gap-2 min-w-0 text-sm text-gray-900"><MapPin className="w-4 h-4 text-blue-600 shrink-0" /><span className="truncate">{value.city || value.address}</span></span>
        <button type="button" onClick={() => onChange(null)} className="text-xs font-bold text-blue-700 hover:underline shrink-0">{t('alerts.changeArea')}</button>
      </div>
    );
  }
  return (
    <div className="relative">
      <div className="relative">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input id={id} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('alerts.wherePh')} className={`${input} pl-9`} autoComplete="off" />
        {busy && <Loader2 className="w-4 h-4 text-blue-500 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />}
      </div>
      {results.length > 0 && (
        <ul className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-56 overflow-y-auto divide-y divide-gray-100">
          {results.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => { onChange({ lat: r.lat, lng: r.lng, address: r.address, city: r.city }); setQ(''); setResults([]); }} className="w-full text-left px-3 py-2 hover:bg-blue-50">
                <span className="block text-sm font-semibold text-gray-900 truncate">{r.city}</span>
                <span className="block text-xs text-gray-500 truncate">{r.subtitle}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" onClick={useGps} disabled={locating} className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:underline disabled:opacity-60">
        {locating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5" />} {locating ? t('alerts.locating') : t('alerts.useMyLocation')}
      </button>
    </div>
  );
}

function SearchForm({ initial, maxRadius, onSave, onCancel }: { initial?: SavedSearch; maxRadius: number; onSave: (v: SavedSearchInput) => Promise<void>; onCancel: () => void }) {
  const { t } = useI18n();
  const [label, setLabel] = useState(initial?.label ?? '');
  const [category, setCategory] = useState<string>(initial?.category ?? '');
  const [keywords, setKeywords] = useState(initial?.keywords ?? '');
  const [place, setPlace] = useState<GeoLocation | null>(initial?.location ?? null);
  const [radius, setRadius] = useState(Math.min(initial?.radiusKm ?? 5, maxRadius));
  const [lostOn, setLostOn] = useState(initial?.lostOn ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (label.trim().length < 2) return setError(t('alerts.errLabel'));
    if (!place) return setError(t('alerts.errPlace'));
    setBusy(true);
    setError(null);
    try {
      await onSave({ label: label.trim(), category: category || null, keywords: keywords.trim(), location: { lat: place.lat, lng: place.lng, address: place.city || place.address }, radiusKm: radius, lostOn: lostOn || null });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.somethingWrong'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="mt-4 rounded-2xl border border-blue-200 bg-blue-50/40 p-4 space-y-3">
      {error && <p role="alert" className="text-sm font-semibold text-red-800 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>}
      <div>
        <label htmlFor="ss-label" className="block text-xs font-bold text-gray-700 mb-1">{t('alerts.label')}</label>
        <input id="ss-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t('alerts.labelPh')} maxLength={80} className={input} />
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="ss-cat" className="block text-xs font-bold text-gray-700 mb-1">{t('alerts.category')}</label>
          <select id="ss-cat" value={category} onChange={(e) => setCategory(e.target.value)} className={input}>
            <option value="">{t('alerts.anyCategory')}</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{t(`categories.${c}` as TKey)}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="ss-date" className="block text-xs font-bold text-gray-700 mb-1">{t('alerts.lostOn')}</label>
          <input id="ss-date" type="date" value={lostOn} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setLostOn(e.target.value)} className={input} />
        </div>
      </div>
      <div>
        <label htmlFor="ss-kw" className="block text-xs font-bold text-gray-700 mb-1">{t('alerts.keywords')}</label>
        <input id="ss-kw" value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder={t('alerts.keywordsPh')} maxLength={200} aria-describedby="ss-kw-hint" className={input} />
        <p id="ss-kw-hint" className="mt-1 text-[0.6875rem] text-gray-500">{t('alerts.keywordsHint')}</p>
      </div>
      <div className="grid sm:grid-cols-[1fr_auto] gap-3">
        <div>
          <label htmlFor="ss-place" className="block text-xs font-bold text-gray-700 mb-1">{t('alerts.where')}</label>
          <PlaceField id="ss-place" value={place} onChange={setPlace} />
        </div>
        <div>
          <label htmlFor="ss-radius" className="block text-xs font-bold text-gray-700 mb-1">{t('alerts.radius')}</label>
          <select id="ss-radius" value={radius} onChange={(e) => setRadius(Number(e.target.value))} className={input}>
            {ALERT_RADII.map((km) => (
              <option key={km} value={km} disabled={km > maxRadius}>{km > maxRadius ? t('alerts.premiumOnly', { km }) : t('alerts.radiusKm', { km })}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-wrap justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className={btnSecondary}>{t('alerts.cancel')}</button>
        <button type="submit" disabled={busy} className={btnPrimary}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {t('alerts.save')}</button>
      </div>
    </form>
  );
}

export default function AlertsView() {
  const { t, formatDate } = useI18n();
  const [user, setUser] = useState<User | null>(null);
  const [checked, setChecked] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [data, setData] = useState<AlertsData | null>(null);
  const [prefsData, setPrefsData] = useState<PrefsData | null>(null);
  const [push, setPush] = useState<PushState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<SavedSearch | 'new' | null>(null);
  const [areaEdit, setAreaEdit] = useState(false);
  const [stopped, setStopped] = useState<string | null>(null);
  const noticeRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const [a, p] = await Promise.all([api.alerts.get(), api.notifications.prefs()]);
      setData(a);
      setPrefsData(p);
      setError(null);
      // Keep the stored user's plan in step (ads are hidden for Premium).
      const stored = getStoredUser();
      if (stored && stored.plan !== a.plan) setStoredUser({ ...stored, plan: a.plan });
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 401)) setError(e instanceof Error ? e.message : t('common.somethingWrong'));
    }
  }, [t]);

  useEffect(() => {
    setStopped(new URLSearchParams(window.location.search).get('stopped'));
    const stored = getStoredUser();
    if (stored) setUser(stored);
    fetchCurrentUser()
      .then((u) => {
        setUser(u);
        setStoredUser(u);
        if (u) load();
      })
      .catch(() => {})
      .finally(() => setChecked(true));
    pushState().then(setPush).catch(() => setPush('unsupported'));
    const onUnauthorized = () => {
      setStoredUser(null);
      setUser(null);
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, [load]);

  const flash = (msg: string) => {
    setNotice(msg);
    requestAnimationFrame(() => noticeRef.current?.focus());
  };

  const savePrefs = async (patch: Parameters<typeof api.notifications.savePrefs>[0]) => {
    try {
      const prefs = await api.notifications.savePrefs(patch);
      setPrefsData((d) => (d ? { ...d, prefs } : d));
    } catch (e) {
      alert(e instanceof Error ? e.message : t('common.somethingWrong'));
    }
  };

  const togglePush = async () => {
    try {
      const next = push === 'on' ? await unsubscribePush() : await subscribePush();
      setPush(next);
      api.notifications.prefs().then(setPrefsData).catch(() => {});
    } catch (e) {
      alert(e instanceof Error ? e.message : t('common.somethingWrong'));
    }
  };

  const premium = data?.plan === 'premium';
  const limits = data?.limits ?? PLAN_LIMITS.free;
  const prefs = prefsData?.prefs;

  const header = (
    <header className="sticky top-0 z-40 w-full bg-white/90 backdrop-blur-md border-b border-gray-100">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2 text-sm font-bold text-gray-700 hover:text-blue-700 min-w-0">
          <ArrowLeft className="w-4 h-4 shrink-0" /> <span className="truncate">{t('common.backToSearch')}</span>
        </Link>
        <div className="flex items-center gap-2">
          <LanguageSwitcher compact />
          {user && <NotificationBell />}
        </div>
      </div>
    </header>
  );

  if (checked && !user) {
    return (
      <div className="flex-1 flex flex-col bg-slate-50">
        {header}
        <main id="main-content" tabIndex={-1} className="max-w-lg mx-auto w-full px-4 py-16 flex-1 text-center focus:outline-none">
          <BellRing className="w-10 h-10 mx-auto text-blue-600 mb-3" />
          <h1 className="text-2xl font-black text-gray-900">{t('alerts.signInTitle')}</h1>
          <p className="mt-2 text-sm text-gray-600">{t('alerts.signInBody')}</p>
          <button onClick={() => setShowAuth(true)} className={`${btnPrimary} mt-6`}>{t('alerts.signIn')}</button>
        </main>
        <AuthModal isOpen={showAuth} promptMessage={null} onClose={() => setShowAuth(false)} onLoginSuccess={(u) => { setUser(u); setShowAuth(false); load(); }} />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-50">
      {header}
      <main id="main-content" tabIndex={-1} className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 flex-1 space-y-6 focus:outline-none">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">{t('alerts.pageTitle')}</h1>
          <p className="mt-1 text-sm text-gray-600">{t('alerts.pageDesc')}</p>
        </div>

        {stopped && (
          <div role="status" className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm font-semibold text-amber-900">
            {stopped === 'nearby' ? t('alerts.stoppedNearby') : stopped === 'match_email' ? t('alerts.stoppedMatch') : t('alerts.stoppedInvalid')}
          </div>
        )}
        {notice && (
          <div ref={noticeRef} tabIndex={-1} role="status" className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm font-semibold text-emerald-900 flex items-start justify-between gap-3 focus:outline-none">
            <span>{notice}</span>
            <button onClick={() => setNotice(null)} aria-label={t('common.close')} className="shrink-0"><X className="w-4 h-4" /></button>
          </div>
        )}
        {error && <div role="alert" className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm font-semibold text-red-800">{error}</div>}

        {!data || !prefs ? (
          !error && <div className="flex justify-center py-16 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : (
          <>
            {/* ---------------- Plan ---------------- */}
            <section aria-labelledby="plan-title" className={card}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 id="plan-title" className="text-lg font-black text-gray-900 flex items-center gap-2"><Crown className="w-5 h-5 text-amber-500" /> {t('premium.title')}</h2>
                  <p className="mt-1 text-sm text-gray-600">
                    {premium ? <><strong className="text-gray-900">{t('premium.active')}</strong>{data.subscription ? ` · ${t('premium.since', { date: formatDate(data.subscription.since) })}` : ''}</> : <>{t('premium.current')}: <strong className="text-gray-900">{t('premium.free')}</strong></>}
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">{t('premium.launchBadge')}</span>
              </div>

              <div className="mt-4">
                <table className="w-full text-xs sm:text-sm table-fixed">
                  <thead>
                    <tr className="text-left border-b border-gray-200">
                      <th scope="col" className="w-[34%] py-2 pr-2 sm:pr-3 font-semibold text-gray-500">{t('premium.feature')}</th>
                      <th scope="col" className={`py-2 px-2 sm:px-3 font-bold ${!premium ? 'text-blue-700' : 'text-gray-700'}`}>{t('premium.free')}</th>
                      <th scope="col" className={`py-2 pl-2 sm:pl-3 font-bold ${premium ? 'text-amber-700' : 'text-gray-700'}`}><span className="inline-flex items-center gap-1"><Crown className="w-3.5 h-3.5" /> {t('premium.premium')}</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {[
                      [t('premium.fSearches'), String(PLAN_LIMITS.free.savedSearches), String(PLAN_LIMITS.premium.savedSearches)],
                      [t('premium.fAlerts'), t('premium.fAlertsFree'), t('premium.fAlertsPremium')],
                      [t('premium.fRadius'), t('premium.fRadiusVal', { km: PLAN_LIMITS.free.maxAlertRadiusKm }), t('premium.fRadiusVal', { km: PLAN_LIMITS.premium.maxAlertRadiusKm })],
                      [t('premium.fAds'), t('premium.fAdsFree'), t('premium.fAdsPremium')],
                      [t('premium.fBoosts'), String(PLAN_LIMITS.free.boostsPer30Days), String(PLAN_LIMITS.premium.boostsPer30Days)],
                      [t('premium.fPhoto'), '—', t('premium.comingSoon')],
                    ].map(([f, a, b]) => (
                      <tr key={f}>
                        <th scope="row" className="py-2 pr-2 sm:pr-3 text-left align-top font-normal text-gray-700">{f}</th>
                        <td className="py-2 px-2 sm:px-3 align-top text-gray-800">{a}</td>
                        <td className="py-2 pl-2 sm:pl-3 align-top text-gray-900 font-semibold">{b}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="text-xs text-gray-500">
                  <s>{t('premium.priceMonth', { price: rupees(PREMIUM_PRICES.monthly.pricePaise) })} · {t('premium.priceQuarter', { price: rupees(PREMIUM_PRICES.quarterly.pricePaise) })} · {t('premium.priceYear', { price: rupees(PREMIUM_PRICES.yearly.pricePaise) })}</s>
                  <br />
                  {t('premium.launchNote')}
                </p>
                {premium ? (
                  <button
                    onClick={async () => {
                      if (!confirm(t('premium.cancelConfirm'))) return;
                      await api.premium.cancel().catch((e) => alert(e.message));
                      load();
                    }}
                    className={`${btnSecondary} shrink-0`}
                  >
                    {t('premium.cancel')}
                  </button>
                ) : (
                  <button
                    onClick={async () => {
                      try {
                        await api.premium.activate();
                        flash(t('premium.activated'));
                        load();
                      } catch (e) {
                        alert(e instanceof Error ? e.message : t('common.somethingWrong'));
                      }
                    }}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold shadow shrink-0"
                  >
                    <Crown className="w-4 h-4" /> {t('premium.get')}
                  </button>
                )}
              </div>
            </section>

            {/* ---------------- Match alerts ---------------- */}
            <section aria-labelledby="match-title" className={card}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 id="match-title" className="text-lg font-black text-gray-900 flex items-center gap-2"><Sparkles className="w-5 h-5 text-emerald-600" /> {t('alerts.matchTitle')}</h2>
                  <p className="mt-1 text-sm text-gray-600">{t('alerts.matchDesc')}</p>
                </div>
                {editing === null && data.searches.length < limits.savedSearches && (
                  <button onClick={() => setEditing('new')} className={btnPrimary}><Plus className="w-4 h-4" /> {t('alerts.add')}</button>
                )}
              </div>
              {editing === null && data.searches.length >= limits.savedSearches && !premium && (
                <p className="mt-3 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">{t('alerts.limitReached', { count: limits.savedSearches, premium: PLAN_LIMITS.premium.savedSearches })}</p>
              )}

              {editing === 'new' && (
                <SearchForm
                  maxRadius={limits.maxAlertRadiusKm}
                  onCancel={() => setEditing(null)}
                  onSave={async (v) => {
                    const r = await api.alerts.create(v);
                    setEditing(null);
                    flash(r.existingMatches ? t('alerts.createdWithMatches', { count: r.existingMatches }) : t('alerts.created'));
                    load();
                  }}
                />
              )}

              {data.searches.length === 0 && editing === null ? (
                <p className="mt-4 text-sm text-gray-500">{t('alerts.none')}</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {data.searches.map((s) =>
                    editing !== 'new' && editing?.id === s.id ? (
                      <li key={s.id}>
                        <SearchForm
                          initial={s}
                          maxRadius={limits.maxAlertRadiusKm}
                          onCancel={() => setEditing(null)}
                          onSave={async (v) => {
                            await api.alerts.update(s.id, v);
                            setEditing(null);
                            load();
                          }}
                        />
                      </li>
                    ) : (
                      <li key={s.id} className={`rounded-2xl border p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3 ${s.active ? 'border-gray-200' : 'border-dashed border-gray-300 bg-gray-50'}`}>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-gray-900 flex flex-wrap items-center gap-2">
                            {s.label}
                            {!s.active && <span className="text-[0.6875rem] font-bold uppercase bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full">{t('alerts.paused')}</span>}
                            {!!s.matchCount && <span className="text-[0.6875rem] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">{t('alerts.matchesN', { count: s.matchCount })}</span>}
                          </p>
                          <p className="text-xs text-gray-600 mt-0.5">
                            {s.category ? t(`categories.${s.category}` as TKey) : t('alerts.anyCategory')}
                            {s.keywords ? ` · “${s.keywords}”` : ''} · {t('alerts.within', { km: s.radiusKm, place: s.location.address })}
                            {s.lostOn ? ` · ${t('alerts.since', { date: formatDate(s.lostOn) })}` : ''}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2 shrink-0">
                          <button onClick={() => setEditing(s)} className={btnSecondary}><Pencil className="w-3.5 h-3.5" /> {t('alerts.edit')}</button>
                          <button
                            onClick={async () => {
                              await api.alerts.update(s.id, { active: !s.active }).catch((e) => alert(e.message));
                              load();
                            }}
                            disabled={!s.active && data.searches.filter((x) => x.active).length >= limits.savedSearches}
                            className={btnSecondary}
                          >
                            {s.active ? <><Pause className="w-3.5 h-3.5" /> {t('alerts.pause')}</> : <><Play className="w-3.5 h-3.5" /> {t('alerts.resume')}</>}
                          </button>
                          <button
                            onClick={async () => {
                              if (!confirm(t('alerts.deleteConfirm'))) return;
                              await api.alerts.remove(s.id).catch((e) => alert(e.message));
                              load();
                            }}
                            className={`${btnSecondary} hover:text-red-700 hover:border-red-200`}
                          >
                            <Trash2 className="w-3.5 h-3.5" /> {t('alerts.delete')}
                          </button>
                        </div>
                      </li>
                    )
                  )}
                </ul>
              )}
            </section>

            {/* ---------------- Matches ---------------- */}
            {data.searches.length > 0 && (
              <section aria-labelledby="matches-title" className={card}>
                <h2 id="matches-title" className="text-lg font-black text-gray-900">{t('alerts.matchesTitle')}</h2>
                {data.matches.length === 0 ? (
                  <p className="mt-2 text-sm text-gray-500">{t('alerts.matchesEmpty')}</p>
                ) : (
                  <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {data.matches.map((m) => (
                      <li key={m.id}>
                        <Link href={`/?item=${encodeURIComponent(m.item.id)}`} className="flex gap-3 rounded-2xl border border-gray-200 p-3 hover:border-blue-300 hover:bg-blue-50/40 transition">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={m.item.images[0] || 'https://images.unsplash.com/photo-1584824486509-112e4181ff6b?w=200&auto=format&fit=crop&q=60'} alt="" className="w-16 h-16 rounded-xl object-cover shrink-0 bg-gray-100" />
                          <span className="min-w-0">
                            <span className="block text-sm font-bold text-gray-900 truncate">{m.item.title}</span>
                            <span className="block text-xs text-gray-600 truncate">{m.item.address}</span>
                            <span className="block text-xs text-gray-500">{t('alerts.kmAway', { km: m.item.distanceKm.toFixed(1) })} · {formatDate(m.item.occurredAt)}</span>
                            <span className="block text-xs font-bold text-blue-700 mt-0.5">{t('alerts.open')} →</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {/* ---------------- Settings ---------------- */}
            <section aria-labelledby="settings-title" className={card}>
              <h2 id="settings-title" className="text-lg font-black text-gray-900 flex items-center gap-2"><BellRing className="w-5 h-5 text-blue-600" /> {t('alerts.settingsTitle')}</h2>

              <div className="mt-2 divide-y divide-gray-100">
                {/* Push on this device */}
                <div className="py-3 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <span>
                    <span className="block text-sm font-bold text-gray-900">{t('alerts.pushTitle')}</span>
                    <span className="block text-xs text-gray-600 mt-0.5">{t('alerts.pushDesc')}</span>
                    {push === 'denied' && <span className="block text-xs text-red-700 mt-1">{t('alerts.pushDenied')}</span>}
                    {push === 'unsupported' && <span className="block text-xs text-gray-500 mt-1">{t('alerts.pushUnsupported')} {t('alerts.pushFallback')}</span>}
                    {push === 'needs_install' && <span className="block text-xs text-gray-700 mt-1">{t('alerts.pushNeedsInstall')}</span>}
                    {push === 'not_configured' && <span className="block text-xs text-gray-500 mt-1">{t('alerts.pushNotConfigured')} {t('alerts.pushFallback')}</span>}
                  </span>
                  {(push === 'on' || push === 'off') && (
                    <button onClick={togglePush} className={push === 'on' ? btnSecondary : `${btnPrimary} text-xs px-3 py-2`}>
                      {push === 'on' ? t('alerts.pushTurnOff') : t('alerts.pushTurnOn')}
                    </button>
                  )}
                </div>

                {/* Nearby alerts */}
                <div className="py-1">
                  <Toggle id="pref-nearby" checked={prefs.nearbyAlerts} onChange={(v) => savePrefs({ nearbyAlerts: v })} label={t('alerts.nearbyOn')} desc={t('alerts.nearbyDesc')} />
                  {prefs.nearbyAlerts && (
                    <div className="pb-3 space-y-3 sm:pl-0">
                      <div>
                        <p className="text-xs font-bold text-gray-700 mb-1">{t('alerts.area')}</p>
                        {areaEdit ? (
                          <PlaceField
                            id="pref-area"
                            value={null}
                            onChange={(v) => {
                              if (!v) return;
                              setAreaEdit(false);
                              savePrefs({ area: { lat: v.lat, lng: v.lng, label: v.city || v.address } });
                            }}
                          />
                        ) : prefs.area ? (
                          <div className="flex flex-wrap items-center gap-2 text-sm">
                            <span className="inline-flex items-center gap-1.5 text-gray-900"><MapPin className="w-4 h-4 text-blue-600" /> {prefs.area.label}</span>
                            <button onClick={() => setAreaEdit(true)} className="text-xs font-bold text-blue-700 hover:underline">{t('alerts.changeArea')}</button>
                            <button onClick={() => savePrefs({ area: null })} className="text-xs font-bold text-gray-500 hover:underline">{t('alerts.removeArea')}</button>
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs text-amber-800">{t('alerts.areaNone')}</span>
                            <button onClick={() => setAreaEdit(true)} className={btnSecondary}><MapPin className="w-3.5 h-3.5" /> {t('alerts.setArea')}</button>
                          </div>
                        )}
                        <p className="mt-1 text-[0.6875rem] text-gray-500">{t('alerts.areaHint')}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <label htmlFor="pref-limit" className="text-xs font-bold text-gray-700">{t('alerts.perDay')}</label>
                        <select id="pref-limit" value={prefs.nearbyDailyLimit} onChange={(e) => savePrefs({ nearbyDailyLimit: Number(e.target.value) === 2 ? 2 : 1 })} className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white">
                          <option value={1}>{t('alerts.perDayOne')}</option>
                          <option value={2}>{t('alerts.perDayTwo')}</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {/* Match alert channels */}
                <div className="py-1">
                  <p className="pt-3 text-sm font-bold text-gray-900">{t('alerts.matchChannels')}</p>
                  <Toggle id="pref-match-email" checked={prefs.matchEmail} onChange={(v) => savePrefs({ matchEmail: v })} label={t('alerts.matchEmail')} desc={!prefsData.hasEmail ? t('alerts.noEmail') : undefined} disabled={!prefsData.hasEmail} />
                  <Toggle id="pref-match-push" checked={prefs.matchPush} onChange={(v) => savePrefs({ matchPush: v })} label={t('alerts.matchPush')} />
                </div>

                {/* Quiet hours */}
                <div className="py-3">
                  <p className="text-sm font-bold text-gray-900">{t('alerts.quiet')}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{t('alerts.quietDesc')}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                    <label htmlFor="q-from" className="text-xs font-bold text-gray-700">{t('alerts.from')}</label>
                    <select id="q-from" value={prefs.quietStart} onChange={(e) => savePrefs({ quietStart: Number(e.target.value) })} className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white">
                      {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{`${String(h).padStart(2, '0')}:00`}</option>)}
                    </select>
                    <label htmlFor="q-to" className="text-xs font-bold text-gray-700">{t('alerts.to')}</label>
                    <select id="q-to" value={prefs.quietEnd} onChange={(e) => savePrefs({ quietEnd: Number(e.target.value) })} className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white">
                      {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{`${String(h).padStart(2, '0')}:00`}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
