'use client';

import React from 'react';
import { Item } from '@/types';
import { X, Printer, MapPin, Calendar } from 'lucide-react';
import { useI18n } from '@/i18n/LanguageProvider';

interface PrintFlyerModalProps {
  item: Item | null;
  onClose: () => void;
}

export default function PrintFlyerModal({ item, onClose }: PrintFlyerModalProps) {
  const { t, formatDate } = useI18n();
  if (!item) return null;

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = formatDate(item.occurredAt, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const photo = item.images && item.images.length > 0
    ? item.images[0]
    : 'https://images.unsplash.com/photo-1584824486509-112e4181ff6b?w=600&auto=format&fit=crop&q=80';

  const shareUrl = typeof window !== 'undefined' ? window.location.href : 'https://lostfound.community';
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(shareUrl)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-sm animate-fade-in overflow-y-auto">
      {/* Controls Bar */}
      <div role="dialog" aria-modal="true" aria-labelledby="flyer-title" className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden my-auto border border-gray-200">
        <div className="flex items-center justify-between px-6 py-3.5 bg-gray-900 text-white print:hidden">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-amber-400" />
            <h2 id="flyer-title" className="font-bold text-sm">{t('flyer.preview')}</h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs rounded-xl shadow transition flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" />
              <span>{t('flyer.print')}</span>
            </button>
            <button
              onClick={onClose}
              aria-label={t('flyer.close')}
              className="p-1.5 text-gray-300 hover:text-white rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Paper Canvas */}
        <div className="p-8 sm:p-10 bg-white text-gray-900 print:p-0 print:m-0" id="flyer-content">
          {/* Top Urgent Banner */}
          <div className="text-center border-b-4 border-red-600 pb-4 mb-6">
            <p className="text-4xl sm:text-5xl font-black uppercase tracking-tight text-red-600">
              {t('flyer.helpFind')}
            </p>
            <p className="text-2xl sm:text-3xl font-extrabold text-gray-900 mt-1 capitalize">
              {item.title}
            </p>
          </div>

          {/* Reward Callout if available */}
          {item.reward && item.reward > 0 && (
            <div className="mb-6 bg-amber-400 border-2 border-black p-3 text-center rounded-2xl shadow-sm">
              <span className="text-xs uppercase tracking-widest font-black text-black block">
                {t('flyer.reward')}
              </span>
              <span className="text-3xl font-black text-black">
                {t('flyer.cashReward', { amount: item.reward })}
              </span>
            </div>
          )}

          {/* Photo & Key Information Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center mb-6">
            <div className="rounded-2xl overflow-hidden border-2 border-gray-900 aspect-square bg-gray-100 shadow-sm">
              <img
                src={photo}
                alt={item.title}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 border border-gray-200 p-4 rounded-2xl">
                <div className="flex items-start gap-2 mb-2">
                  <MapPin className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-gray-500">
                      {t('flyer.lastSeen')}
                    </div>
                    <div className="text-sm font-extrabold text-gray-900">
                      {item.location.address}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2 pt-2 border-t border-gray-200">
                  <Calendar className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-gray-500">
                      {t('flyer.whenLost')}
                    </div>
                    <div className="text-sm font-extrabold text-gray-900">
                      {formattedDate}
                    </div>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">
                  {t('flyer.features')}
                </div>
                <p className="text-xs text-gray-700 leading-relaxed bg-white border border-gray-200 p-3 rounded-xl">
                  {item.description}
                </p>
              </div>
            </div>
          </div>

          {/* Bottom QR Code & Contact Section */}
          <div className="border-t-4 border-gray-900 pt-6 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex-1 space-y-2 text-center sm:text-left">
              <div className="text-base font-black text-gray-900 uppercase">
                {t('flyer.ifSeen')}
              </div>
              <div className="text-xl font-black text-blue-700">
                {item.userPhone || item.userEmail || t('flyer.messagePoster')}
              </div>
              <div className="text-xs text-gray-500">
                {t('flyer.reportSafely')}
              </div>
            </div>

            <div className="flex flex-col items-center text-center shrink-0">
              <img
                src={qrCodeUrl}
                alt={t('flyer.scanQr')}
                className="w-24 h-24 border border-gray-300 rounded-xl p-1 bg-white shadow-xs"
              />
              <span className="text-[0.625rem] font-bold text-gray-500 mt-1 uppercase">
                {t('flyer.scan')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

