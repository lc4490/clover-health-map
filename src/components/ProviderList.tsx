"use client";

import type { Provider } from "@/types/provider";

interface ProviderListProps {
  providers: Provider[];
  total: number;
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

const TYPE_DOT: Record<string, string> = {
  practitioner: "bg-blue-500",
  facility: "bg-emerald-500",
  "medical equipment": "bg-amber-500",
};

function fmtPhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return phone;
}

function fmtDist(d: number): string {
  return d < 10 ? `${d.toFixed(1)} mi` : `${Math.round(d)} mi`;
}

export default function ProviderList({
  providers,
  total,
  loading,
  selectedId,
  onSelect,
  page,
  pageSize,
  onPageChange,
}: ProviderListProps) {
  const totalPages = Math.ceil(total / pageSize);
  const rangeStart = (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-500 py-20">
        <div className="w-8 h-8 border-4 border-green-700 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm">Searching…</p>
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400 py-20 px-6 text-center">
        <span className="text-5xl">🏥</span>
        <p className="text-sm leading-relaxed">
          Enter a ZIP code above and click{" "}
          <span className="font-semibold text-gray-600">Search</span> to find
          providers near you.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Result count bar */}
      <div className="flex-shrink-0 px-4 py-2 bg-white border-b text-xs text-gray-500">
        {rangeStart}–{rangeEnd} of{" "}
        <span className="font-medium text-gray-700">{total.toLocaleString()}</span>{" "}
        providers
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
        {providers.map((p) => {
          const isSelected = p.provider_id === selectedId;
          return (
            <button
              key={p.provider_id}
              onClick={() => onSelect(p.provider_id)}
              className={`w-full text-left px-3 py-3 transition-colors hover:bg-green-50 border-l-4 ${
                isSelected
                  ? "border-green-600 bg-green-50"
                  : "border-transparent"
              }`}
            >
              {/* Row 1: dot + name + preferred */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${
                    TYPE_DOT[p.provider_type] ?? "bg-gray-400"
                  }`}
                />
                <span className="text-sm font-semibold text-gray-900 truncate">
                  {p.full_name}
                </span>
                {p.is_preferred && (
                  <span className="text-yellow-500 text-xs font-medium" title="Preferred provider">
                    ★ Preferred
                  </span>
                )}
              </div>

              {/* Specialty */}
              <p className="text-xs text-gray-600 mt-0.5 truncate pl-3.5">
                {p.specialties}
              </p>

              {/* Practice */}
              <p className="text-xs text-gray-500 truncate pl-3.5">
                {p.practice_name}
              </p>

              {/* Address */}
              <p className="text-xs text-gray-500 mt-1 pl-3.5">
                {p.address1}
                {p.address2 ? ` ${p.address2}` : ""}, {p.city}, {p.office_state}
              </p>

              {/* Phone + distance + accepting badge */}
              <div className="flex items-center justify-between mt-1 pl-3.5">
                <span className="text-xs text-gray-400">
                  {p.phone ? fmtPhone(p.phone) : ""}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-400">{fmtDist(p.distance)}</span>
                  {p.is_accepting_new_patients ? (
                    <span className="text-[11px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">
                      Accepting
                    </span>
                  ) : (
                    <span className="text-[11px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-medium">
                      Full
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-t bg-white text-sm">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
            className="text-green-700 disabled:text-gray-300 hover:text-green-900 disabled:cursor-not-allowed font-medium"
          >
            ← Prev
          </button>
          <span className="text-xs text-gray-500">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page === totalPages}
            className="text-green-700 disabled:text-gray-300 hover:text-green-900 disabled:cursor-not-allowed font-medium"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
