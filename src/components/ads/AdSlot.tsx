'use client';
// One AdSense ad unit. Renders nothing unless ads are active for this visitor
// (see AdsProvider) and the slot has an ad unit id in /admin/ads.
// Each slot reserves its height up front so the page doesn't jump when the ad loads;
// a slot Google leaves empty collapses (globals.css: .lf-ad with data-ad-status="unfilled").
import React, { useEffect, useRef } from 'react';
import { useAds } from './AdsProvider';
import { useI18n } from '@/i18n/LanguageProvider';
import type { AdSlotKey } from '@/lib/monetization';
import { track } from '@/lib/track';

type Kind = 'leaderboard' | 'rectangle' | 'infeed' | 'responsive';

const INS_CLASS: Record<Kind, string> = {
  // Fixed sizes per breakpoint (AdSense reads the size from the element).
  leaderboard: 'inline-block w-[320px] h-[50px] md:w-[728px] md:h-[90px]',
  rectangle: 'inline-block w-[300px] h-[250px]',
  infeed: 'block min-h-[250px]',
  responsive: 'block min-h-[100px]',
};

export default function AdSlot({ slot, kind, className = '' }: { slot: AdSlotKey; kind: Kind; className?: string }) {
  const ads = useAds();
  const { t } = useI18n();
  const ref = useRef<HTMLModElement>(null);
  const slotId = ads?.settings.slots[slot] ?? '';
  const layoutKey = ads?.settings.infeedLayoutKey ?? '';
  const show = !!ads?.active && !!slotId && (kind !== 'infeed' || !!layoutKey);

  useEffect(() => {
    const ins = ref.current;
    if (!show || !ins) return;
    // Ask AdSense to fill this <ins> once (React may run effects twice in development).
    if (!ins.dataset.adsbygoogleStatus) {
      try {
        ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
      } catch (e) {
        console.warn('[ads] push failed', e);
      }
    }
    // Count an impression once the filled ad is at least half on screen.
    let counted = false;
    let poll: ReturnType<typeof setInterval> | undefined;
    const io = new IntersectionObserver(
      ([entry]) => {
        clearInterval(poll);
        if (!entry.isIntersecting || counted) return;
        let tries = 0;
        const check = () => {
          const status = ins.getAttribute('data-ad-status');
          if (status === 'filled') {
            counted = true;
            clearInterval(poll);
            io.disconnect();
            track('ad_impression', { slot });
          } else if (status === 'unfilled' || ++tries > 10) clearInterval(poll);
        };
        check();
        if (!counted) poll = setInterval(check, 1000);
      },
      { threshold: 0.5 }
    );
    io.observe(ins);
    return () => {
      io.disconnect();
      clearInterval(poll);
    };
  }, [show, slot]);

  if (!show) return null;

  return (
    <aside aria-label={t('ads.label')} className={`lf-ad text-center print:hidden ${className}`}>
      <p className="text-[0.625rem] uppercase tracking-wider text-gray-500 mb-1">{t('ads.label')}</p>
      <ins
        ref={ref}
        className={`adsbygoogle ${INS_CLASS[kind]}`}
        data-ad-client={ads!.settings.client}
        data-ad-slot={slotId}
        {...(kind === 'infeed' ? { 'data-ad-format': 'fluid', 'data-ad-layout-key': layoutKey } : {})}
        {...(kind === 'responsive' ? { 'data-ad-format': 'auto', 'data-full-width-responsive': 'true' } : {})}
        {...(ads!.settings.testMode ? { 'data-adtest': 'on' } : {})}
      />
    </aside>
  );
}
