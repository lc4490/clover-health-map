"use client";

import dynamic from "next/dynamic";
import { useState, useCallback } from "react";
import SearchForm from "@/components/SearchForm";
import ProviderList from "@/components/ProviderList";
import type {
  Provider,
  SearchParams,
  ProvidersResponse,
} from "@/types/provider";

// Leaflet requires the browser — load the Map component client-side only
const Map = dynamic(() => import("@/components/Map"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-400 text-sm">
      Loading map…
    </div>
  ),
});

const DEFAULT_PARAMS: SearchParams = {
  zip_code: "",
  page: 1,
  page_size: 20,
  radius: 20,
  provider_types: ["practitioner", "facility", "medical equipment"],
  sort: "relevant",
};

export default function Home() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [params, setParams] = useState<SearchParams>(DEFAULT_PARAMS);
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  const search = useCallback(async (newParams: SearchParams) => {
    setLoading(true);
    setError(null);
    setSelectedId(null);
    setParams(newParams);

    const qs = new URLSearchParams();
    qs.set("zip_code", newParams.zip_code);
    qs.set("page", String(newParams.page));
    qs.set("page_size", String(newParams.page_size));
    qs.set("radius", String(newParams.radius));
    newParams.provider_types.forEach((t) => qs.append("provider_types", t));
    qs.set("sort", newParams.sort);
    if (newParams.q) qs.set("q", newParams.q);

    try {
      const res = await fetch(`/api/providers?${qs}`);
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data: ProvidersResponse = await res.json();
      setProviders(data.results);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setProviders([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  const handlePageChange = useCallback(
    (page: number) => search({ ...params, page }),
    [params, search],
  );

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="flex-shrink-0 bg-green-800 text-white px-5 py-3 flex items-center gap-3 shadow-md z-10">
        <span className="text-2xl" aria-hidden>
          🏥
        </span>
        <div>
          <h1 className="text-lg font-bold leading-tight">
            Clover Health Provider Map
          </h1>
          <p className="text-green-300 text-xs">
            New Jersey In-Network Providers
          </p>
        </div>

        {/* Marker-type legend (compact, header) */}
        <div className="ml-auto hidden sm:flex items-center gap-4 text-xs text-green-200">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-400" />
            Practitioner
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400" />
            Facility
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400" />
            Equipment
          </span>
        </div>
      </header>

      {/* ── Search bar ─────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 shadow-sm z-10">
        <SearchForm
          initialParams={DEFAULT_PARAMS}
          onSearch={search}
          loading={loading}
          onLocate={setUserLocation}
        />
      </div>

      {/* ── Error banner ───────────────────────────────────────────────── */}
      {error && (
        <div className="flex-shrink-0 bg-red-50 border-b border-red-200 px-4 py-2 text-sm text-red-700">
          ⚠ {error}
        </div>
      )}

      {/* ── Main panel ─────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — provider list */}
        <aside className="w-80 xl:w-96 flex-shrink-0 border-r border-gray-200 bg-gray-50 flex flex-col overflow-hidden">
          <ProviderList
            providers={providers}
            total={total}
            loading={loading}
            selectedId={selectedId}
            onSelect={setSelectedId}
            page={params.page}
            pageSize={params.page_size}
            onPageChange={handlePageChange}
          />
        </aside>

        {/* Map */}
        <main className="flex-1 relative">
          <Map
            providers={providers}
            selectedId={selectedId}
            onSelect={setSelectedId}
            userLocation={userLocation}
          />
        </main>
      </div>
    </div>
  );
}
