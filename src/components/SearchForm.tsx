"use client";

import { FormEvent, useState } from "react";
import type { SearchParams } from "@/types/provider";

interface SearchFormProps {
  initialParams: SearchParams;
  onSearch: (params: SearchParams) => void;
  loading: boolean;
  onLocate?: (coords: { lat: number; lng: number }) => void;
}

const PROVIDER_TYPES = [
  { value: "practitioner", label: "Practitioners" },
  { value: "facility", label: "Facilities" },
  { value: "medical equipment", label: "Medical Equipment" },
];

const RADIUS_OPTIONS = [5, 10, 20, 50];

// Reverse-geocode lat/lng → ZIP using Nominatim (free, no key needed)
async function reverseGeocodeZip(lat: number, lng: number): Promise<string> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
    { headers: { "Accept-Language": "en" } },
  );
  if (!res.ok) throw new Error("Reverse geocode failed");
  const data = await res.json();
  const zip: string = data?.address?.postcode ?? "";
  // US ZIP codes are 5 digits; strip ZIP+4 suffix if present
  return zip.replace(/^(\d{5}).*$/, "$1");
}

export default function SearchForm({
  initialParams,
  onSearch,
  loading,
  onLocate,
}: SearchFormProps) {
  const [zip, setZip] = useState(initialParams.zip_code);
  const [radius, setRadius] = useState(initialParams.radius);
  const [types, setTypes] = useState<globalThis.Set<string>>(
    new globalThis.Set(initialParams.provider_types),
  );
  const [sort, setSort] = useState(initialParams.sort);
  const [q, setQ] = useState(initialParams.q ?? "");
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

  const toggleType = (value: string) => {
    setTypes((prev) => {
      const next = new globalThis.Set(prev);
      next.has(value) ? next.delete(value) : next.add(value);
      return next;
    });
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!zip.trim() || types.size === 0) return;
    onSearch({
      zip_code: zip.trim(),
      page: 1,
      page_size: 20,
      radius,
      provider_types: Array.from(types),
      sort,
      q: q.trim() || undefined,
    });
  };

  const handleUseLocation = () => {
    if (!navigator.geolocation) {
      setLocError("Geolocation is not supported by your browser.");
      return;
    }
    setLocating(true);
    setLocError(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          onLocate?.({ lat: latitude, lng: longitude });
          const detectedZip = await reverseGeocodeZip(latitude, longitude);
          if (!detectedZip) {
            setLocError("Could not find a ZIP code for your location.");
            return;
          }
          setZip(detectedZip);
          // Auto-search with the detected ZIP
          onSearch({
            zip_code: detectedZip,
            page: 1,
            page_size: 20,
            radius,
            provider_types: Array.from(types),
            sort,
            q: q.trim() || undefined,
          });
        } catch {
          setLocError(
            "Failed to look up your ZIP code. Try entering it manually.",
          );
        } finally {
          setLocating(false);
        }
      },
      (err) => {
        setLocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          setLocError("Location permission denied. Enter a ZIP code manually.");
        } else {
          setLocError(
            "Could not get your location. Enter a ZIP code manually.",
          );
        }
      },
      { timeout: 10_000 },
    );
  };

  return (
    <div>
      <form
        onSubmit={handleSubmit}
        className="px-4 py-2 flex flex-wrap items-center gap-x-5 gap-y-2"
      >
        {/* Name / keyword search */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-gray-600 whitespace-nowrap">
            Name / Keyword
          </label>
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="e.g. cardiology"
            className="border border-gray-300 rounded px-2 py-1 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {/* ZIP code + locate button */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-gray-600 whitespace-nowrap">
            ZIP Code
          </label>
          <input
            type="text"
            value={zip}
            onChange={(e) => setZip(e.target.value)}
            pattern="\d{5}"
            maxLength={5}
            placeholder="000000"
            required
            className="border border-gray-300 rounded px-2 py-1 text-sm w-20 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <button
            type="button"
            onClick={handleUseLocation}
            disabled={locating || loading}
            title="Use my current location"
            className="flex items-center gap-1 text-xs text-green-700 hover:text-green-900 disabled:text-gray-400 disabled:cursor-not-allowed font-medium whitespace-nowrap"
          >
            {locating ? (
              <>
                <span className="inline-block w-3 h-3 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                Locating…
              </>
            ) : (
              <>📍 Use my location</>
            )}
          </button>
        </div>

        {/* Radius */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-gray-600">Radius</label>
          <select
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            {RADIUS_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r} mi
              </option>
            ))}
          </select>
        </div>

        {/* Provider types */}
        <div className="flex items-center gap-3">
          {PROVIDER_TYPES.map(({ value, label }) => (
            <label
              key={value}
              className="flex items-center gap-1 text-xs cursor-pointer select-none"
            >
              <input
                type="checkbox"
                checked={types.has(value)}
                onChange={() => toggleType(value)}
                className="accent-green-700 w-3.5 h-3.5"
              />
              <span className="text-gray-700">{label}</span>
            </label>
          ))}
        </div>

        {/* Sort */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-gray-600">Sort</label>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="relevant">Relevant</option>
            <option value="distance">Distance</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={loading || types.size === 0}
          className="ml-auto bg-green-700 hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-1.5 rounded text-sm font-semibold transition-colors"
        >
          {loading ? "Searching…" : "Search"}
        </button>
      </form>

      {/* Location error */}
      {locError && (
        <p className="px-4 pb-1.5 text-xs text-red-600">{locError}</p>
      )}
    </div>
  );
}
