'use client';

import React from 'react';
import { Claim, Item } from '@/types';
import { CLAIM_STATUS_LABEL, getRejectionReason } from '@/lib/claims';
import { MapPin, Calendar, CheckCircle2, ShieldCheck } from 'lucide-react';

interface ItemCardProps {
  item: Item & { distanceKm?: number };
  onSelect: (item: Item) => void;
  onClaimClick?: (item: Item) => void;
  /** True when the logged-in user posted this item – they can't claim it. */
  isOwner?: boolean;
  /** The logged-in user's existing claim on this item – they can't claim it again. */
  myClaim?: Claim;
}

const CLAIM_PILL: Record<Claim['status'], string> = {
  pending: 'bg-amber-50 text-amber-700',
  approved: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-red-50 text-red-700',
};

export default function ItemCard({ item, onSelect, onClaimClick, isOwner = false, myClaim }: ItemCardProps) {
  const isFound = item.type === 'found';
  const hasUserPhoto = item.images && item.images.length > 0;
  const coverImage = hasUserPhoto
    ? item.images[0]
    : 'https://images.unsplash.com/photo-1584824486509-112e4181ff6b?w=600&auto=format&fit=crop&q=80';

  const formattedDate = new Date(item.occurredAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div 
      onClick={() => onSelect(item)}
      className="group relative bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-200 overflow-hidden cursor-pointer flex flex-col justify-between"
    >
      <div>
        {/* Image Container with Badges */}
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-gray-100">
          <img
            src={coverImage}
            alt={item.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />

          {/* Type Badge */}
          <div className="absolute top-3 left-3 flex items-center gap-1.5">
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase shadow-md backdrop-blur-md ${
                isFound
                  ? 'bg-emerald-600 text-white'
                  : 'bg-amber-500 text-white'
              }`}
            >
              {isFound ? 'Found Item' : 'Lost Item'}
            </span>
            {item.images.length > 1 && (
              <span className="bg-black/60 text-white backdrop-blur-md text-[11px] font-medium px-2 py-0.5 rounded-full">
                +{item.images.length - 1} photos
              </span>
            )}
          </div>

          {/* Category Tag */}
          <span className="absolute top-3 right-3 bg-white/90 backdrop-blur-md text-gray-800 text-xs font-semibold px-2.5 py-1 rounded-lg capitalize shadow">
            {item.category}
          </span>

          {/* Distance Badge if available */}
          {item.distanceKm !== undefined && (
            <div className="absolute bottom-3 left-3 bg-blue-600/90 text-white backdrop-blur-md text-xs font-semibold px-2.5 py-1 rounded-md shadow-sm flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              <span>{item.distanceKm.toFixed(1)} km away</span>
            </div>
          )}
        </div>

        {/* Content Section */}
        <div className="p-4 sm:p-5">
          <h3 className="font-bold text-gray-900 text-base sm:text-lg line-clamp-1 group-hover:text-blue-600 transition-colors">
            {item.title}
          </h3>

          <p className="mt-1.5 text-xs sm:text-sm text-gray-600 line-clamp-2 leading-relaxed">
            {item.description}
          </p>

          <div className="mt-4 pt-3 border-t border-gray-100 flex flex-col gap-1.5 text-xs text-gray-500">
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <span className="truncate">{item.location.address}</span>
            </div>

            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <span>{formattedDate}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer / Action */}
      <div className="px-4 pb-4 pt-1 sm:px-5 sm:pb-5 flex items-center justify-between gap-2">
        <span className="text-xs text-gray-500 flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>3-Point Verified</span>
        </span>

        {isOwner ? (
          <span
            title="You posted this item, so you can't claim it"
            className="text-xs font-semibold bg-gray-100 text-gray-500 px-3 py-1.5 rounded-lg cursor-default"
          >
            Posted by you
          </span>
        ) : myClaim ? (
          <span
            title={myClaim.status === 'rejected' && getRejectionReason(myClaim) ? `Reason: ${getRejectionReason(myClaim)}` : CLAIM_STATUS_LABEL[myClaim.status]}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg cursor-default ${CLAIM_PILL[myClaim.status]}`}
          >
            {myClaim.status === 'pending' ? 'Already claimed' : myClaim.status === 'approved' ? 'Claim approved' : 'Claim rejected'}
          </span>
        ) : isFound ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onClaimClick) onClaimClick(item);
              else onSelect(item);
            }}
            className="text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white px-3 py-1.5 rounded-lg transition-colors"
          >
            Claim Item
          </button>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect(item);
            }}
            className="text-xs font-semibold bg-amber-50 text-amber-700 hover:bg-amber-600 hover:text-white px-3 py-1.5 rounded-lg transition-colors"
          >
            I Found This
          </button>
        )}
      </div>
    </div>
  );
}

