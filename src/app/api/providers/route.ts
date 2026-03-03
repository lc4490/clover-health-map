import { NextRequest, NextResponse } from "next/server";
import type { Provider } from "@/types/provider";

// ---------------------------------------------------------------------------
// In-memory geocode cache — persists for the lifetime of the server process
// key: "address1|city|state"  value: {lat, lng} or null (no match)
// ---------------------------------------------------------------------------
const geocodeCache = new Map<string, { lat: number; lng: number } | null>();

// ---------------------------------------------------------------------------
// Parse one line of the Census batch geocoder CSV response
// Actual format (all fields are quoted):
//   "id","inputAddr","Match|No_Match","matchType","matchedAddr","lng,lat","tigerLineId","side"
// ---------------------------------------------------------------------------
function parseCensusLine(line: string): {
  id: number;
  lat?: number;
  lng?: number;
} | null {
  // ID is the first quoted integer: "0","..."
  const idMatch = line.match(/^"(\d+)"/);
  if (!idMatch) return null;
  const id = parseInt(idMatch[1], 10);

  if (line.includes("No_Match")) return { id };

  // Coordinates are the only quoted pair of signed decimals: "-74.123,40.456"
  const coordMatch = line.match(/"(-?\d+\.\d+),(-?\d+\.\d+)"/);
  if (!coordMatch) return { id };

  return {
    id,
    lng: parseFloat(coordMatch[1]),
    lat: parseFloat(coordMatch[2]),
  };
}

// ---------------------------------------------------------------------------
// Batch-geocode providers using the US Census Geocoder (free, no API key)
// Fills provider.lat / provider.lng in place; misses are left undefined.
// ---------------------------------------------------------------------------
async function geocodeProviders(providers: Provider[]): Promise<void> {
  // Split into uncached vs cached
  const uncached: { idx: number; provider: Provider }[] = [];

  for (let i = 0; i < providers.length; i++) {
    const p = providers[i];
    const key = `${p.address1}|${p.city}|${p.office_state}`;
    const cached = geocodeCache.get(key);

    if (cached !== undefined) {
      // Cache hit (could be null = known no-match)
      if (cached) {
        p.lat = cached.lat;
        p.lng = cached.lng;
      }
    } else {
      uncached.push({ idx: i, provider: p });
    }
  }

  if (uncached.length === 0) return;

  // Build CSV for batch endpoint: id,address,city,state,zip
  const csvRows = uncached.map(({ idx, provider: p }) => {
    const addr = p.address1.replace(/"/g, "");
    const zip = p.zip_code.slice(0, 5);
    return `${idx},"${addr}","${p.city}","${p.office_state}","${zip}"`;
  });

  const formData = new FormData();
  formData.append(
    "addressFile",
    new Blob([csvRows.join("\n")], { type: "text/plain" }),
    "addresses.csv"
  );
  formData.append("benchmark", "Public_AR_Current");

  try {
    const res = await fetch(
      "https://geocoding.geo.census.gov/geocoder/locations/addressbatch",
      { method: "POST", body: formData, signal: AbortSignal.timeout(12_000) }
    );

    if (!res.ok) throw new Error(`Census geocoder HTTP ${res.status}`);

    const text = await res.text();

    for (const line of text.trim().split("\n")) {
      const parsed = parseCensusLine(line.trim());
      if (!parsed) continue;

      const { idx, provider } = uncached.find((u) => u.idx === parsed.id) ?? {};
      if (!provider) continue;

      const key = `${provider.address1}|${provider.city}|${provider.office_state}`;

      if (parsed.lat !== undefined && parsed.lng !== undefined) {
        geocodeCache.set(key, { lat: parsed.lat, lng: parsed.lng });
        provider.lat = parsed.lat;
        provider.lng = parsed.lng;
      } else {
        geocodeCache.set(key, null);
      }

      void idx; // suppress unused-var warning
    }
  } catch (err) {
    console.error("[geocode] batch request failed:", err);
    // Mark all uncached addresses as null so we don't retry on every request
    for (const { provider: p } of uncached) {
      const key = `${p.address1}|${p.city}|${p.office_state}`;
      if (!geocodeCache.has(key)) geocodeCache.set(key, null);
    }
  }
}

// ---------------------------------------------------------------------------
// GET /api/providers — proxy Clover Health search + geocode results
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  const incoming = req.nextUrl.searchParams;

  // Forward all params to Clover Health
  const params = new URLSearchParams();
  incoming.forEach((value, key) => params.append(key, value));

  let cloverData: {
    results: Provider[];
    total: number;
    page: number;
    page_size: number;
  };

  try {
    const upstream = await fetch(
      `https://www.cloverhealth.com/api/provider-search-v2/provider-search?${params}`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          Referer: "https://www.cloverhealth.com/",
        },
        signal: AbortSignal.timeout(10_000),
      }
    );

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Clover Health API error: ${upstream.status}` },
        { status: 502 }
      );
    }

    cloverData = await upstream.json();
  } catch (err) {
    console.error("[providers] upstream fetch failed:", err);
    return NextResponse.json(
      { error: "Failed to reach Clover Health API" },
      { status: 502 }
    );
  }

  const providers: Provider[] = cloverData.results ?? [];

  // Geocode addresses (cache makes repeated pages fast)
  await geocodeProviders(providers);

  return NextResponse.json({
    results: providers,
    total: cloverData.total,
    page: cloverData.page,
    page_size: cloverData.page_size,
  });
}
