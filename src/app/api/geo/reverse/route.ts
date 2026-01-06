import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type NominatimReverseResult = {
  display_name?: string;
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ message: "Missing lat/lng" }, { status: 400 });
  }

  const nominatimUrl = new URL("https://nominatim.openstreetmap.org/reverse");
  nominatimUrl.searchParams.set("lat", String(lat));
  nominatimUrl.searchParams.set("lon", String(lng));
  nominatimUrl.searchParams.set("format", "jsonv2");
  nominatimUrl.searchParams.set("zoom", "14");

  const res = await fetch(nominatimUrl.toString(), {
    headers: {
      "User-Agent": "sport-partner-finder/1.0 (local-dev)",
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    return NextResponse.json({ message: "Reverse geocoding failed" }, { status: 502 });
  }

  const raw = (await res.json()) as unknown;
  const displayName =
    raw && typeof raw === "object" && "display_name" in raw
      ? (raw as NominatimReverseResult).display_name
      : undefined;

  return NextResponse.json({
    displayName: typeof displayName === "string" ? displayName : null,
  });
}

