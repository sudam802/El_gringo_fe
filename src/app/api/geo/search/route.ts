import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type NominatimSearchResult = {
  display_name?: string;
  lat?: string;
  lon?: string;
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (!q || q.length < 3) {
    return NextResponse.json({ results: [] });
  }

  const nominatimUrl = new URL("https://nominatim.openstreetmap.org/search");
  nominatimUrl.searchParams.set("q", q);
  nominatimUrl.searchParams.set("format", "json");
  nominatimUrl.searchParams.set("addressdetails", "0");
  nominatimUrl.searchParams.set("limit", "6");

  const res = await fetch(nominatimUrl.toString(), {
    headers: {
      "User-Agent": "sport-partner-finder/1.0 (local-dev)",
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    return NextResponse.json(
      { message: "Geocoding provider error", results: [] },
      { status: 502 }
    );
  }

  const raw = (await res.json()) as unknown;
  const items = Array.isArray(raw) ? (raw as NominatimSearchResult[]) : [];

  const results = items
    .map((it) => {
      const displayName = typeof it.display_name === "string" ? it.display_name : "";
      const lat = typeof it.lat === "string" ? Number(it.lat) : NaN;
      const lng = typeof it.lon === "string" ? Number(it.lon) : NaN;
      if (!displayName || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return { displayName, lat, lng };
    })
    .filter(Boolean);

  return NextResponse.json({ results });
}

