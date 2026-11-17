'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Accessibility, AArrowDown, AArrowUp, Contrast, Droplet, Eye, EyeOff, Link2, MousePointer2, Pause, Play,
  RotateCcw, Square, Type, Volume2, WholeWord, X, ZapOff, MousePointerClick, TextCursor,
} from 'lucide-react';
import { useI18n } from '@/i18n/LanguageProvider';
import { LOCALE_TAG } from '@/i18n/config';
import type { TKey } from '@/i18n/translate';
import { A11Y_STORAGE_KEY, A11Y_TOGGLES, A11yToggle } from '@/lib/a11ySettings';

// -------------------------------------------------------------------
// Settings – persisted per browser in localStorage and applied as
// classes on <html>. A matching inline script in app/layout.tsx
// re-applies them before first paint so pages never flash.
// -------------------------------------------------------------------
type ColorMode = 'default' | 'contrast' | 'invert' | 'grayscale';
const TOGGLES = A11Y_TOGGLES;
type Toggle = A11yToggle;

interface Settings extends Record<Toggle, boolean> {
  fontScale: number;
  colorMode: ColorMode;
}

const DEFAULTS: Settings = {
  fontScale: 1,
  colorMode: 'default',
  highlightLinks: false,
  readableFont: false,
  textSpacing: false,
  stopAnimations: false,
  bigCursor: false,
  hideImages: false,
};

const FONT_MIN = 0.9;
const FONT_MAX = 1.6;
const FONT_STEP = 0.1;

function loadSettings(): Settings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(A11Y_STORAGE_KEY) || '{}') };
  } catch {
    return DEFAULTS;
  }
}

function applySettings(s: Settings) {
  const root = document.documentElement;
  root.style.fontSize = s.fontScale === 1 ? '' : `${Math.round(s.fontScale * 100)}%`;
  for (const mode of ['contrast', 'invert', 'grayscale']) root.classList.toggle(`a11y-${mode}`, s.colorMode === mode);
  for (const key of TOGGLES) root.classList.toggle(`a11y-${key}`, s[key]);
}

// -------------------------------------------------------------------
// Text to speech (Web Speech API)
// -------------------------------------------------------------------
type SpeechState = 'idle' | 'speaking' | 'paused';

/** Long text is cut into sentence-sized chunks: some browsers stop a single utterance after ~15 s. */
function chunkText(text: string, max = 220): string[] {
  const sentences = text.replace(/\s+/g, ' ').match(/[^.!?।]+[.!?।]*\s*/g) ?? [text];
  const chunks: string[] = [];
  let current = '';
  for (const s of sentences) {
    if ((current + s).length > max && current) {
      chunks.push(current.trim());
      current = '';
    }
    current += s;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

export default function AccessibilityWidget() {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [speech, setSpeech] = useState<SpeechState>('idle');
  const [clickToRead, setClickToRead] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const readingElRef = useRef<Element | null>(null);

  const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  // Load saved settings once (the boot script has already applied them visually).
  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      applySettings(next);
      try {
        localStorage.setItem(A11Y_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // storage blocked (private mode): settings still apply for this page view
      }
      return next;
    });
  }, []);

  const reset = () => {
    stopSpeech();
    setClickToRead(false);
    update(DEFAULTS);
  };

  // ---- speech -------------------------------------------------------
  const clearReadingHighlight = () => {
    readingElRef.current?.classList.remove('a11y-reading');
    readingElRef.current = null;
  };

  const stopSpeech = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    clearReadingHighlight();
    setSpeech('idle');
  }, []);

  const speak = useCallback(
    (text: string, highlight?: Element) => {
      if (!speechSupported) {
        setNotice(t('a11y.noSpeech'));
        return;
      }
      const synth = window.speechSynthesis;
      synth.cancel();
      clearReadingHighlight();
      const tag = LOCALE_TAG[lang];
      const voices = synth.getVoices();
      const voice =
        voices.find((v) => v.lang === tag) ?? voices.find((v) => v.lang.toLowerCase().startsWith(lang)) ?? null;
      setNotice(lang === 'hi' && voices.length > 0 && !voice ? t('a11y.noHindiVoice') : null);

      const chunks = chunkText(text);
      if (chunks.length === 0) return;
      if (highlight) {
        highlight.classList.add('a11y-reading');
        readingElRef.current = highlight;
      }
      chunks.forEach((chunk, i) => {
        const u = new SpeechSynthesisUtterance(chunk);
        u.lang = tag;
        if (voice) u.voice = voice;
        u.rate = 0.95;
        if (i === chunks.length - 1) {
          u.onend = () => {
            clearReadingHighlight();
            setSpeech('idle');
          };
        }
        u.onerror = () => {
          clearReadingHighlight();
          setSpeech('idle');
        };
        synth.speak(u);
      });
      setSpeech('speaking');
    },
    [lang, speechSupported, t]
  );

  const readPage = () => {
    const main = document.getElementById('main-content') ?? document.body;
    speak(main.innerText);
  };

  const readSelection = () => {
    const text = window.getSelection()?.toString().trim();
    if (!text) {
      setNotice(t('a11y.noSelection'));
      return;
    }
    speak(text);
  };

  const togglePause = () => {
    const synth = window.speechSynthesis;
    if (speech === 'speaking') {
      synth.pause();
      setSpeech('paused');
    } else if (speech === 'paused') {
      synth.resume();
      setSpeech('speaking');
    }
  };

  // Stop speaking when the language changes or the page unloads.
  useEffect(() => stopSpeech, [lang, stopSpeech]);

  // Click-to-read mode: clicking a piece of text inside <main> reads it.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('a11y-clickToRead', clickToRead);
    if (!clickToRead) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target || panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      const el = target.closest('p, h1, h2, h3, h4, h5, h6, li, td, th, label, dt, dd, a, button, span');
      const text = (el as HTMLElement | null)?.innerText?.trim();
      if (el && text) speak(text, el);
    };
    document.addEventListener('click', onClick, true);
    return () => {
      document.removeEventListener('click', onClick, true);
      root.classList.remove('a11y-clickToRead');
    };
  }, [clickToRead, speak]);

  // ---- panel open/close + keyboard ------------------------------------
  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.code === 'KeyA') {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === 'Escape' && open) {
        close();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  useEffect(() => {
    if (open) panelRef.current?.querySelector<HTMLElement>('button, a, input')?.focus();
  }, [open]);

  const pct = Math.round(settings.fontScale * 100);
  const round = (n: number) => Math.round(n * 10) / 10;

  const colorOptions: { mode: ColorMode; label: TKey; Icon: typeof Contrast }[] = [
    { mode: 'default', label: 'a11y.colorDefault', Icon: Eye },
    { mode: 'contrast', label: 'a11y.colorContrast', Icon: Contrast },
    { mode: 'invert', label: 'a11y.colorInvert', Icon: Droplet },
    { mode: 'grayscale', label: 'a11y.colorGray', Icon: Square },
  ];

  const toggleOptions: { key: Toggle; label: TKey; Icon: typeof Link2 }[] = [
    { key: 'highlightLinks', label: 'a11y.highlightLinks', Icon: Link2 },
    { key: 'readableFont', label: 'a11y.readableFont', Icon: Type },
    { key: 'textSpacing', label: 'a11y.textSpacing', Icon: WholeWord },
    { key: 'stopAnimations', label: 'a11y.stopAnimations', Icon: ZapOff },
    { key: 'bigCursor', label: 'a11y.bigCursor', Icon: MousePointer2 },
    { key: 'hideImages', label: 'a11y.hideImages', Icon: EyeOff },
  ];

  const sectionTitle = 'text-[0.6875rem] font-bold uppercase tracking-wider text-gray-500 mb-2';
  const chip = (active: boolean) =>
    `flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold text-left transition ${
      active ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-200 text-gray-800 hover:bg-gray-50'
    }`;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="a11y-panel"
        aria-label={t('a11y.open')}
        title={`${t('a11y.open')} (${t('a11y.shortcut')})`}
        className="fixed left-4 bottom-4 z-[60] w-12 h-12 rounded-full bg-blue-700 text-white shadow-lg hover:bg-blue-800 flex items-center justify-center print:hidden"
      >
        <Accessibility className="w-6 h-6" aria-hidden="true" />
      </button>

      {open && (
        <div
          ref={panelRef}
          id="a11y-panel"
          role="dialog"
          aria-modal="false"
          aria-labelledby="a11y-title"
          className="fixed left-4 bottom-20 z-[60] w-[calc(100vw-2rem)] max-w-sm max-h-[calc(100vh-7rem)] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-gray-200 print:hidden"
        >
          <div className="sticky top-0 bg-white flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h2 id="a11y-title" className="font-black text-gray-900 flex items-center gap-2">
              <Accessibility className="w-5 h-5 text-blue-700" aria-hidden="true" /> {t('a11y.title')}
            </h2>
            <button type="button" onClick={close} aria-label={t('a11y.close')} className="p-1.5 rounded-full text-gray-500 hover:bg-gray-100">
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>

          <div className="p-4 space-y-5">
            {/* Text size */}
            <section aria-labelledby="a11y-size">
              <h3 id="a11y-size" className={sectionTitle}>{t('a11y.textSize')}</h3>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => update({ fontScale: round(Math.max(FONT_MIN, settings.fontScale - FONT_STEP)) })} disabled={settings.fontScale <= FONT_MIN} aria-label={t('a11y.decrease')} className="p-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-40">
                  <AArrowDown className="w-5 h-5" aria-hidden="true" />
                </button>
                <output aria-live="polite" className="flex-1 text-center text-sm font-bold text-gray-900 tabular-nums">{pct}%</output>
                <button type="button" onClick={() => update({ fontScale: round(Math.min(FONT_MAX, settings.fontScale + FONT_STEP)) })} disabled={settings.fontScale >= FONT_MAX} aria-label={t('a11y.increase')} className="p-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-40">
                  <AArrowUp className="w-5 h-5" aria-hidden="true" />
                </button>
                <button type="button" onClick={() => update({ fontScale: 1 })} disabled={settings.fontScale === 1} aria-label={t('a11y.resetSize')} className="p-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-40">
                  <RotateCcw className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </section>

            {/* Colours */}
            <section aria-labelledby="a11y-colors">
              <h3 id="a11y-colors" className={sectionTitle}>{t('a11y.colors')}</h3>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-labelledby="a11y-colors">
                {colorOptions.map(({ mode, label, Icon }) => (
                  <button key={mode} type="button" role="radio" aria-checked={settings.colorMode === mode} onClick={() => update({ colorMode: mode })} className={chip(settings.colorMode === mode)}>
                    <Icon className="w-4 h-4 shrink-0" aria-hidden="true" /> {t(label)}
                  </button>
                ))}
              </div>
            </section>

            {/* Read aloud */}
            <section aria-labelledby="a11y-speech">
              <h3 id="a11y-speech" className={sectionTitle}>{t('a11y.readAloud')}</h3>
              {speechSupported ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={readPage} className={chip(false)}>
                      <Volume2 className="w-4 h-4 shrink-0" aria-hidden="true" /> {t('a11y.readPage')}
                    </button>
                    <button type="button" onClick={readSelection} className={chip(false)}>
                      <TextCursor className="w-4 h-4 shrink-0" aria-hidden="true" /> {t('a11y.readSelection')}
                    </button>
                  </div>
                  <button type="button" aria-pressed={clickToRead} onClick={() => setClickToRead((v) => !v)} className={`${chip(clickToRead)} w-full`}>
                    <MousePointerClick className="w-4 h-4 shrink-0" aria-hidden="true" /> {t('a11y.clickToRead')}
                  </button>
                  {speech !== 'idle' && (
                    <div className="flex gap-2">
                      <button type="button" onClick={togglePause} className={`${chip(false)} flex-1 justify-center`}>
                        {speech === 'speaking' ? <Pause className="w-4 h-4" aria-hidden="true" /> : <Play className="w-4 h-4" aria-hidden="true" />}
                        {speech === 'speaking' ? t('a11y.pause') : t('a11y.resume')}
                      </button>
                      <button type="button" onClick={stopSpeech} className={`${chip(false)} flex-1 justify-center`}>
                        <Square className="w-4 h-4" aria-hidden="true" /> {t('a11y.stop')}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-600">{t('a11y.noSpeech')}</p>
              )}
              {notice && (
                <p role="status" className="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                  {notice}
                </p>
              )}
            </section>

            {/* Other toggles */}
            <section aria-labelledby="a11y-more">
              <h3 id="a11y-more" className={sectionTitle}>{t('a11y.more')}</h3>
              <div className="grid grid-cols-2 gap-2">
                {toggleOptions.map(({ key, label, Icon }) => (
                  <button key={key} type="button" aria-pressed={settings[key]} onClick={() => update({ [key]: !settings[key] } as Partial<Settings>)} className={chip(settings[key])}>
                    <Icon className="w-4 h-4 shrink-0" aria-hidden="true" /> {t(label)}
                  </button>
                ))}
              </div>
            </section>

            <div className="flex items-center justify-between gap-2 pt-3 border-t border-gray-100">
              <button type="button" onClick={reset} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-gray-700 border border-gray-300 hover:bg-gray-50">
                <RotateCcw className="w-4 h-4" aria-hidden="true" /> {t('a11y.resetAll')}
              </button>
              <Link href="/accessibility" onClick={() => setOpen(false)} className="text-xs font-bold text-blue-700 underline underline-offset-2">
                {t('a11y.statementLink')}
              </Link>
            </div>
            <p className="text-[0.6875rem] text-gray-500">{t('a11y.shortcut')}</p>
          </div>
        </div>
      )}
    </>
  );
}
