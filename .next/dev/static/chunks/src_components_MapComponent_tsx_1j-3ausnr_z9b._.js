(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/src/components/MapComponent.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>MapComponent
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$leaflet$2f$dist$2f$leaflet$2d$src$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/leaflet/dist/leaflet-src.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$i18n$2f$LanguageProvider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/i18n/LanguageProvider.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$i18n$2f$config$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/i18n/config.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
;
/** Item titles and addresses are user input – escape them before putting them in popup HTML. */ const esc = (s)=>s.replace(/[&<>"']/g, (c)=>({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        })[c]);
function MapComponent({ items = [], centerLocation, radiusKm = 5, onSelectItem, pickerMode = false, selectedCoord, onCoordSelect, height = '480px' }) {
    _s();
    const { t, lang } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$i18n$2f$LanguageProvider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useI18n"])();
    const mapContainerRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const mapInstanceRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const markersLayerRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const circleLayerRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    // Initialize Map
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "MapComponent.useEffect": ()=>{
            if (!mapContainerRef.current || mapInstanceRef.current) return;
            const defaultLat = centerLocation?.lat || 37.7749;
            const defaultLng = centerLocation?.lng || -122.4194;
            const map = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$leaflet$2f$dist$2f$leaflet$2d$src$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].map(mapContainerRef.current, {
                center: [
                    defaultLat,
                    defaultLng
                ],
                zoom: 13,
                zoomControl: true
            });
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$leaflet$2f$dist$2f$leaflet$2d$src$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                maxZoom: 19
            }).addTo(map);
            const markersLayer = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$leaflet$2f$dist$2f$leaflet$2d$src$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].layerGroup().addTo(map);
            markersLayerRef.current = markersLayer;
            mapInstanceRef.current = map;
            return ({
                "MapComponent.useEffect": ()=>{
                    map.remove();
                    mapInstanceRef.current = null;
                }
            })["MapComponent.useEffect"];
        }
    }["MapComponent.useEffect"], []);
    // Handle map click for picker mode
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "MapComponent.useEffect": ()=>{
            const map = mapInstanceRef.current;
            if (!map) return;
            const handleMapClick = {
                "MapComponent.useEffect.handleMapClick": (e)=>{
                    if (pickerMode && onCoordSelect) {
                        onCoordSelect({
                            lat: e.latlng.lat,
                            lng: e.latlng.lng
                        });
                    }
                }
            }["MapComponent.useEffect.handleMapClick"];
            map.on('click', handleMapClick);
            return ({
                "MapComponent.useEffect": ()=>{
                    map.off('click', handleMapClick);
                }
            })["MapComponent.useEffect"];
        }
    }["MapComponent.useEffect"], [
        pickerMode,
        onCoordSelect
    ]);
    // Update center, radius circle, and markers
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "MapComponent.useEffect": ()=>{
            const map = mapInstanceRef.current;
            const markersLayer = markersLayerRef.current;
            if (!map || !markersLayer) return;
            markersLayer.clearLayers();
            // 1. Draw Radius Circle if center location provided
            if (centerLocation && !pickerMode) {
                if (circleLayerRef.current) {
                    circleLayerRef.current.remove();
                }
                const circle = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$leaflet$2f$dist$2f$leaflet$2d$src$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].circle([
                    centerLocation.lat,
                    centerLocation.lng
                ], {
                    radius: radiusKm * 1000,
                    color: '#3B82F6',
                    fillColor: '#93C5FD',
                    fillOpacity: 0.15,
                    weight: 2
                }).addTo(map);
                circleLayerRef.current = circle;
                // Add center user marker
                const centerIcon = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$leaflet$2f$dist$2f$leaflet$2d$src$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].divIcon({
                    className: 'user-location-pin',
                    html: `
          <div style="background-color: #2563EB; width: 22px; height: 22px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(37,99,235,0.6);"></div>
        `,
                    iconSize: [
                        22,
                        22
                    ],
                    iconAnchor: [
                        11,
                        11
                    ]
                });
                __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$leaflet$2f$dist$2f$leaflet$2d$src$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].marker([
                    centerLocation.lat,
                    centerLocation.lng
                ], {
                    icon: centerIcon
                }).bindTooltip(t('map.searchCenter', {
                    km: radiusKm
                }), {
                    direction: 'top'
                }).addTo(markersLayer);
            } else if (circleLayerRef.current) {
                circleLayerRef.current.remove();
                circleLayerRef.current = null;
            }
            // 2. Picker Mode: show selected coordinate pin
            if (pickerMode && selectedCoord) {
                const pinIcon = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$leaflet$2f$dist$2f$leaflet$2d$src$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].divIcon({
                    className: 'picker-pin',
                    html: `
          <div style="background-color: #EF4444; color: white; width: 32px; height: 32px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px rgba(0,0,0,0.3); border: 2px solid white;">
            <div style="transform: rotate(45deg); font-weight: bold; font-size: 14px;">📍</div>
          </div>
        `,
                    iconSize: [
                        32,
                        32
                    ],
                    iconAnchor: [
                        16,
                        32
                    ]
                });
                __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$leaflet$2f$dist$2f$leaflet$2d$src$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].marker([
                    selectedCoord.lat,
                    selectedCoord.lng
                ], {
                    icon: pinIcon
                }).bindTooltip(t('map.dropHere'), {
                    permanent: true,
                    direction: 'top'
                }).addTo(markersLayer);
                map.panTo([
                    selectedCoord.lat,
                    selectedCoord.lng
                ]);
                return;
            }
            // 3. Render items markers
            items.forEach({
                "MapComponent.useEffect": (item)=>{
                    const isFound = item.type === 'found';
                    const bgColor = isFound ? '#10B981' : '#F59E0B'; // Emerald for found, Amber for lost
                    const badgeText = isFound ? t('map.found') : t('map.lost');
                    const customIcon = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$leaflet$2f$dist$2f$leaflet$2d$src$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].divIcon({
                        className: 'custom-item-marker',
                        html: `
          <div style="background: white; border-radius: 8px; padding: 3px 6px; box-shadow: 0 4px 10px rgba(0,0,0,0.18); border: 2px solid ${bgColor}; display: flex; align-items: center; gap: 4px; font-family: sans-serif; cursor: pointer;">
            <span style="display:inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: ${bgColor};"></span>
            <span style="font-weight: 700; font-size: 11px; color: #1F2937;">${badgeText}</span>
          </div>
        `,
                        iconSize: [
                            64,
                            28
                        ],
                        iconAnchor: [
                            32,
                            28
                        ]
                    });
                    const marker = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$leaflet$2f$dist$2f$leaflet$2d$src$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].marker([
                        item.location.lat,
                        item.location.lng
                    ], {
                        icon: customIcon
                    });
                    const popupContent = document.createElement('div');
                    popupContent.style.minWidth = '200px';
                    popupContent.innerHTML = `
        <div style="font-family: inherit;">
          ${item.images[0] ? `<img src="${esc(item.images[0])}" alt="" style="width: 100%; height: 110px; object-fit: cover; border-radius: 6px; margin-bottom: 8px;" />` : ''}
          <div style="font-weight: 700; font-size: 14px; margin-bottom: 4px; color: #111827;">${esc(item.title)}</div>
          <div style="font-size: 12px; color: #6B7280; margin-bottom: 6px;">📍 ${esc(item.location.address)}</div>
          <div style="font-size: 11px; color: #4B5563; margin-bottom: 8px;">🕒 ${new Date(item.occurredAt).toLocaleString(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$i18n$2f$config$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["LOCALE_TAG"][lang])}</div>
          <button type="button" id="view-btn-${esc(item.id)}" style="width: 100%; background-color: #2563EB; color: white; padding: 6px 12px; border-radius: 6px; font-weight: 600; font-size: 12px; border: none; cursor: pointer;">
            ${esc(t('map.viewDetails'))}
          </button>
        </div>
      `;
                    popupContent.querySelector("button")?.addEventListener('click', {
                        "MapComponent.useEffect": ()=>{
                            if (onSelectItem) onSelectItem(item);
                        }
                    }["MapComponent.useEffect"]);
                    marker.bindPopup(popupContent);
                    markersLayer.addLayer(marker);
                }
            }["MapComponent.useEffect"]);
            if (items.length > 0 && !centerLocation) {
                const bounds = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$leaflet$2f$dist$2f$leaflet$2d$src$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].latLngBounds(items.map({
                    "MapComponent.useEffect.bounds": (i)=>[
                            i.location.lat,
                            i.location.lng
                        ]
                }["MapComponent.useEffect.bounds"]));
                map.fitBounds(bounds, {
                    padding: [
                        40,
                        40
                    ],
                    maxZoom: 15
                });
            }
        }
    }["MapComponent.useEffect"], [
        items,
        centerLocation,
        radiusKm,
        pickerMode,
        selectedCoord,
        onSelectItem,
        t,
        lang
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "relative w-full overflow-hidden rounded-xl border border-gray-200 shadow-sm",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                ref: mapContainerRef,
                role: "region",
                "aria-label": t('map.label'),
                style: {
                    height,
                    width: '100%'
                }
            }, void 0, false, {
                fileName: "[project]/src/components/MapComponent.tsx",
                lineNumber: 198,
                columnNumber: 7
            }, this),
            pickerMode && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "absolute top-3 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur px-4 py-2 rounded-full shadow-lg border border-gray-200 text-xs font-semibold text-gray-700 pointer-events-none z-[1000] flex items-center gap-2",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        "aria-hidden": "true",
                        children: "📍"
                    }, void 0, false, {
                        fileName: "[project]/src/components/MapComponent.tsx",
                        lineNumber: 201,
                        columnNumber: 11
                    }, this),
                    " ",
                    t('map.clickToSet')
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/MapComponent.tsx",
                lineNumber: 200,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/MapComponent.tsx",
        lineNumber: 197,
        columnNumber: 5
    }, this);
}
_s(MapComponent, "2E+rD3cdK5ldU/sHx2DAB02VSk0=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$i18n$2f$LanguageProvider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useI18n"]
    ];
});
_c = MapComponent;
var _c;
__turbopack_context__.k.register(_c, "MapComponent");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/MapComponent.tsx [app-client] (ecmascript, next/dynamic entry)", (function(__turbopack_context__){

__turbopack_context__.n(__turbopack_context__.i("[project]/src/components/MapComponent.tsx [app-client] (ecmascript)"));
}),
]);

//# sourceMappingURL=src_components_MapComponent_tsx_1j-3ausnr_z9b._.js.map