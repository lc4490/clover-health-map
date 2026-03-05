"use client";

import { useEffect, useRef, useState } from "react";
import type { Provider } from "@/types/provider";

interface MapProps {
  providers: Provider[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  userLocation?: { lat: number; lng: number } | null;
}

function fmtDuration(secs: number): string {
  const m = Math.round(secs / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} hr ${m % 60} min`;
}

interface RouteInfo {
  drivingSecs: number;
  walkingSecs: number;
  distanceMi: number | null;
  gmapsUrl: string;
}

function buildPopupHtml(p: Provider, route?: RouteInfo): string {
  const addr = [p.address1, p.address2, `${p.city}, ${p.office_state}`]
    .filter(Boolean)
    .join(", ");

  const routeHtml = route
    ? `<div style="margin-top:8px;padding-top:8px;border-top:1px solid #e5e7eb">
        <div style="display:flex;gap:14px;font-size:12px;margin-bottom:6px;color:#374151">
          <span>🚗 <b>${fmtDuration(route.drivingSecs)}</b>${route.distanceMi != null ? ` · ${route.distanceMi} mi` : ""}</span>
          <span>🚶 <b>${fmtDuration(route.walkingSecs)}</b></span>
        </div>
        <a href="${route.gmapsUrl}" target="_blank" rel="noopener noreferrer"
          style="display:block;text-align:center;background:#2563EB;color:#fff;border-radius:4px;padding:4px 8px;font-size:12px;font-weight:600;text-decoration:none;">
          Open in Google Maps ↗
        </a>
      </div>`
    : "";

  return `
    <div style="min-width:200px;font-family:system-ui,sans-serif;font-size:13px;line-height:1.45">
      <div style="font-weight:700;margin-bottom:2px">${p.full_name}</div>
      <div style="color:#555;margin-bottom:2px">${p.specialties}</div>
      <div style="color:#444;margin-bottom:4px">${p.practice_name}</div>
      <div style="font-size:12px;color:#666">${addr}</div>
      ${p.phone ? `<div style="font-size:12px;color:#666;margin-top:2px">📞 ${p.phone}</div>` : ""}
      <div style="margin-top:6px;font-size:12px;font-weight:600;color:${
        p.is_accepting_new_patients ? "#059669" : "#DC2626"
      }">
        ${p.is_accepting_new_patients ? "✓ Accepting new patients" : "✗ Not accepting new patients"}
      </div>
      ${p.is_preferred ? '<div style="font-size:12px;color:#B45309;margin-top:2px">★ Preferred provider</div>' : ""}
      ${routeHtml}
    </div>`;
}

// Marker colours by provider type
const TYPE_COLOR: Record<string, string> = {
  practitioner: "#2563EB",
  facility: "#059669",
  "medical equipment": "#D97706",
};

export default function ProviderMap({ providers, selectedId, onSelect, userLocation }: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Store Leaflet map + markers in refs so they survive re-renders
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const LRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<globalThis.Map<string, any>>(new globalThis.Map());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userMarkerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const routeLayerRef = useRef<any>(null);
  const providerDataRef = useRef<globalThis.Map<string, Provider>>(new globalThis.Map());
  const [mapReady, setMapReady] = useState(false);

  // ── 1. Initialise map once ────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;

    (async () => {
      const L = await import("leaflet");
      if (cancelled || !containerRef.current || mapRef.current) return;

      LRef.current = L;
      const map = L.map(containerRef.current, {
        center: [40.73, -74.07], // NJ default centre
        zoom: 11,
        zoomControl: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      mapRef.current = map;
      setMapReady(true);
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      LRef.current = null;
      markersRef.current.clear();
    };
  }, []);

  // ── 2. Re-draw markers whenever providers or map-ready state changes ──────
  useEffect(() => {
    const map = mapRef.current;
    const L = LRef.current;
    if (!map || !L || !mapReady) return;

    // Clear old markers + provider data
    markersRef.current.forEach((m) => m.remove());
    markersRef.current.clear();
    providerDataRef.current.clear();

    const bounds: [number, number][] = [];

    providers.forEach((p) => {
      if (p.lat == null || p.lng == null) return;

      const color = TYPE_COLOR[p.provider_type] ?? "#6B7280";
      const star = p.is_preferred ? "★" : "";

      const icon = L.divIcon({
        html: `<div style="
          width:28px;height:28px;
          background:${color};
          border:2.5px solid #fff;
          border-radius:50%;
          box-shadow:0 2px 6px rgba(0,0,0,.4);
          display:flex;align-items:center;justify-content:center;
          color:#fff;font-size:12px;font-weight:700;
          cursor:pointer;
        ">${star}</div>`,
        className: "",
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -16],
      });

      const marker = L.marker([p.lat, p.lng], { icon })
        .bindPopup(buildPopupHtml(p))
        .addTo(map);

      marker.on("click", () => onSelect(p.provider_id));
      markersRef.current.set(p.provider_id, marker);
      providerDataRef.current.set(p.provider_id, p);
      bounds.push([p.lat, p.lng]);
    });

    if (bounds.length > 0) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [50, 50], maxZoom: 14 });
    }
  }, [providers, mapReady, onSelect]);

  // ── 3. Show / update the "you are here" pulsing red dot ──────────────────
  useEffect(() => {
    const map = mapRef.current;
    const L = LRef.current;
    if (!map || !L || !mapReady) return;

    // Remove previous user marker
    userMarkerRef.current?.remove();
    userMarkerRef.current = null;

    if (!userLocation) return;

    const icon = L.divIcon({
      html: `
        <div style="position:relative;width:20px;height:20px;display:flex;align-items:center;justify-content:center;">
          <div class="user-location-pulse" style="
            position:absolute;
            width:20px;height:20px;
            background:#EF4444;
            border-radius:50%;
            opacity:0.8;
          "></div>
          <div style="
            position:relative;
            width:12px;height:12px;
            background:#EF4444;
            border:2.5px solid #fff;
            border-radius:50%;
            box-shadow:0 2px 6px rgba(0,0,0,.4);
          "></div>
        </div>`,
      className: "",
      iconSize: [20, 20],
      iconAnchor: [10, 10],
      popupAnchor: [0, -14],
    });

    userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], { icon, zIndexOffset: 1000 })
      .bindPopup("<b>📍 Your location</b>")
      .addTo(map);

    map.panTo([userLocation.lat, userLocation.lng], { animate: true });
  }, [userLocation, mapReady]);

  // ── 4. Open popup / pan + draw route when a provider is selected ──────────
  useEffect(() => {
    const map = mapRef.current;
    const L = LRef.current;

    // Always clear the previous route
    if (routeLayerRef.current) {
      routeLayerRef.current.remove();
      routeLayerRef.current = null;
    }

    if (!selectedId || !map) return;
    const marker = markersRef.current.get(selectedId);
    if (!marker) return;

    const provider = providerDataRef.current.get(selectedId);

    // Reset popup to base content (no route) while fetching
    if (provider) marker.getPopup()?.setContent(buildPopupHtml(provider));
    marker.openPopup();
    map.panTo(marker.getLatLng(), { animate: true });

    // Fetch driving + walking routes if we have the user's location
    if (!userLocation || !L || !provider) return;

    const { lat: uLat, lng: uLng } = userLocation;
    const { lat: pLat, lng: pLng } = marker.getLatLng();
    const coords = `${uLng},${uLat};${pLng},${pLat}`;
    const osrm = (profile: string, full: boolean) =>
      `https://router.project-osrm.org/route/v1/${profile}/${coords}?overview=${full ? "full&geometries=geojson" : "false"}`;

    Promise.all([
      fetch(osrm("driving", true)).then((r) => r.json()),
      fetch(osrm("foot", false)).then((r) => r.json()),
    ])
      .then(([driveData, walkData]) => {
        if (!mapRef.current || !LRef.current) return;

        // Draw the driving route polyline
        const geojson = driveData?.routes?.[0]?.geometry;
        if (geojson) {
          routeLayerRef.current = LRef.current
            .geoJSON(geojson, {
              style: { color: "#2563EB", weight: 4, opacity: 0.75, dashArray: "6 4" },
            })
            .addTo(mapRef.current);
        }

        // Update popup with travel times + Google Maps link
        const distanceM: number | undefined = driveData?.routes?.[0]?.distance;
        const drivingSecs: number | undefined = driveData?.routes?.[0]?.duration;
        const walkingSecs: number | undefined = walkData?.routes?.[0]?.duration;

        if (drivingSecs != null && walkingSecs != null) {
          const gmapsUrl =
            `https://www.google.com/maps/dir/?api=1` +
            `&origin=${uLat},${uLng}&destination=${pLat},${pLng}&travelmode=driving`;

          marker.getPopup()?.setContent(
            buildPopupHtml(provider, {
              drivingSecs,
              walkingSecs,
              distanceMi: distanceM != null ? Math.round((distanceM / 1609.34) * 10) / 10 : null,
              gmapsUrl,
            }),
          );
          // Refresh open popup so Leaflet repaints it
          if (marker.isPopupOpen()) marker.openPopup();
        }
      })
      .catch(() => {/* silently ignore routing errors */});
  }, [selectedId, userLocation]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />

      {/* Legend */}
      <div className="absolute bottom-8 right-2 z-[1000] bg-white rounded-lg shadow-lg p-3 text-xs space-y-1.5 border border-gray-200">
        {[
          { color: "#2563EB", label: "Practitioner" },
          { color: "#059669", label: "Facility" },
          { color: "#D97706", label: "Medical Equipment" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-2">
            <span
              style={{ background: color }}
              className="inline-block w-3 h-3 rounded-full border border-white shadow-sm flex-shrink-0"
            />
            <span className="text-gray-700">{label}</span>
          </div>
        ))}
        <div className="flex items-center gap-2 border-t pt-1.5 mt-1">
          <span className="text-yellow-600 font-bold leading-none">★</span>
          <span className="text-gray-700">Preferred</span>
        </div>
        {userLocation && (
          <div className="flex items-center gap-2 border-t pt-1.5 mt-1">
            <span className="inline-block w-3 h-3 rounded-full bg-red-500 border border-white shadow-sm flex-shrink-0" />
            <span className="text-gray-700">You</span>
          </div>
        )}
      </div>
    </div>
  );
}
