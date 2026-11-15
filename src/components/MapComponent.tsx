'use client';

import React, { useEffect, useRef } from 'react';
import { Item, GeoLocation } from '@/types';
import L from 'leaflet';

interface MapComponentProps {
  items?: (Item & { distanceKm?: number })[];
  centerLocation?: GeoLocation | null;
  radiusKm?: number;
  onSelectItem?: (item: Item) => void;
  pickerMode?: boolean;
  selectedCoord?: { lat: number; lng: number } | null;
  onCoordSelect?: (coords: { lat: number; lng: number }) => void;
  height?: string;
}

export default function MapComponent({
  items = [],
  centerLocation,
  radiusKm = 5,
  onSelectItem,
  pickerMode = false,
  selectedCoord,
  onCoordSelect,
  height = '480px',
}: MapComponentProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const circleLayerRef = useRef<L.Circle | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const defaultLat = centerLocation?.lat || 37.7749;
    const defaultLng = centerLocation?.lng || -122.4194;

    const map = L.map(mapContainerRef.current, {
      center: [defaultLat, defaultLng],
      zoom: 13,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    const markersLayer = L.layerGroup().addTo(map);
    markersLayerRef.current = markersLayer;
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Handle map click for picker mode
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      if (pickerMode && onCoordSelect) {
        onCoordSelect({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    };

    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [pickerMode, onCoordSelect]);

  // Update center, radius circle, and markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();

    // 1. Draw Radius Circle if center location provided
    if (centerLocation && !pickerMode) {
      if (circleLayerRef.current) {
        circleLayerRef.current.remove();
      }

      const circle = L.circle([centerLocation.lat, centerLocation.lng], {
        radius: radiusKm * 1000, // convert km to meters
        color: '#3B82F6',
        fillColor: '#93C5FD',
        fillOpacity: 0.15,
        weight: 2,
      }).addTo(map);

      circleLayerRef.current = circle;

      // Add center user marker
      const centerIcon = L.divIcon({
        className: 'user-location-pin',
        html: `
          <div style="background-color: #2563EB; width: 22px; height: 22px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(37,99,235,0.6);"></div>
        `,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });

      L.marker([centerLocation.lat, centerLocation.lng], { icon: centerIcon })
        .bindTooltip(`Search Center (Radius: ${radiusKm}km)`, { direction: 'top' })
        .addTo(markersLayer);
    } else if (circleLayerRef.current) {
      circleLayerRef.current.remove();
      circleLayerRef.current = null;
    }

    // 2. Picker Mode: show selected coordinate pin
    if (pickerMode && selectedCoord) {
      const pinIcon = L.divIcon({
        className: 'picker-pin',
        html: `
          <div style="background-color: #EF4444; color: white; width: 32px; height: 32px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px rgba(0,0,0,0.3); border: 2px solid white;">
            <div style="transform: rotate(45deg); font-weight: bold; font-size: 14px;">📍</div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
      });

      L.marker([selectedCoord.lat, selectedCoord.lng], { icon: pinIcon })
        .bindTooltip('Drop location here', { permanent: true, direction: 'top' })
        .addTo(markersLayer);

      map.panTo([selectedCoord.lat, selectedCoord.lng]);
      return;
    }

    // 3. Render items markers
    items.forEach((item) => {
      const isFound = item.type === 'found';
      const bgColor = isFound ? '#10B981' : '#F59E0B'; // Emerald for found, Amber for lost
      const badgeText = isFound ? 'FOUND' : 'LOST';

      const customIcon = L.divIcon({
        className: 'custom-item-marker',
        html: `
          <div style="background: white; border-radius: 8px; padding: 3px 6px; box-shadow: 0 4px 10px rgba(0,0,0,0.18); border: 2px solid ${bgColor}; display: flex; align-items: center; gap: 4px; font-family: sans-serif; cursor: pointer;">
            <span style="display:inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: ${bgColor};"></span>
            <span style="font-weight: 700; font-size: 11px; color: #1F2937;">${badgeText}</span>
          </div>
        `,
        iconSize: [64, 28],
        iconAnchor: [32, 28],
      });

      const marker = L.marker([item.location.lat, item.location.lng], { icon: customIcon });

      const popupContent = document.createElement('div');
      popupContent.style.minWidth = '200px';
      popupContent.innerHTML = `
        <div style="font-family: inherit;">
          ${item.images[0] ? `<img src="${item.images[0]}" alt="${item.title}" style="width: 100%; height: 110px; object-fit: cover; border-radius: 6px; margin-bottom: 8px;" />` : ''}
          <div style="font-weight: 700; font-size: 14px; margin-bottom: 4px; color: #111827;">${item.title}</div>
          <div style="font-size: 12px; color: #6B7280; margin-bottom: 6px;">📍 ${item.location.address}</div>
          <div style="font-size: 11px; color: #4B5563; margin-bottom: 8px;">🕒 ${new Date(item.occurredAt).toLocaleString()}</div>
          <button id="view-btn-${item.id}" style="width: 100%; background-color: #2563EB; color: white; padding: 6px 12px; border-radius: 6px; font-weight: 600; font-size: 12px; border: none; cursor: pointer;">
            View Details & Claim
          </button>
        </div>
      `;

      popupContent.querySelector(`#view-btn-${item.id}`)?.addEventListener('click', () => {
        if (onSelectItem) onSelectItem(item);
      });

      marker.bindPopup(popupContent);
      markersLayer.addLayer(marker);
    });

    if (items.length > 0 && !centerLocation) {
      const bounds = L.latLngBounds(items.map((i) => [i.location.lat, i.location.lng]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  }, [items, centerLocation, radiusKm, pickerMode, selectedCoord, onSelectItem]);

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-gray-200 shadow-sm">
      <div ref={mapContainerRef} style={{ height, width: '100%' }} />
      {pickerMode && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur px-4 py-2 rounded-full shadow-lg border border-gray-200 text-xs font-semibold text-gray-700 pointer-events-none z-[1000] flex items-center gap-2">
          <span>📍</span> Click anywhere on the map to set the geocode location
        </div>
      )}
    </div>
  );
}

