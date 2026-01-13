"use client";

import { useMemo } from "react";

type Props = {
  lat: number;
  lng: number;
  label?: string;
  zoom?: number;
  height?: number;
  className?: string;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function buildOsmEmbedUrl(lat: number, lng: number, zoom: number) {
  const z = clamp(Math.round(zoom), 1, 19);
  const spanLng = 360 / Math.pow(2, z);
  const spanLat = 180 / Math.pow(2, z);
  const halfLng = spanLng * 0.35;
  const halfLat = spanLat * 0.35;

  const left = clamp(lng - halfLng, -180, 180);
  const right = clamp(lng + halfLng, -180, 180);
  const bottom = clamp(lat - halfLat, -90, 90);
  const top = clamp(lat + halfLat, -90, 90);

  const url = new URL("https://www.openstreetmap.org/export/embed.html");
  url.searchParams.set("bbox", `${left},${bottom},${right},${top}`);
  url.searchParams.set("layer", "mapnik");
  url.searchParams.set("marker", `${lat},${lng}`);
  return url.toString();
}

function buildOsmOpenUrl(lat: number, lng: number, zoom: number) {
  const z = clamp(Math.round(zoom), 1, 19);
  return `https://www.openstreetmap.org/#map=${z}/${lat}/${lng}`;
}

export default function MapPreview({
  lat,
  lng,
  label,
  zoom = 15,
  height = 220,
  className,
}: Props) {
  const safeLat = Number.isFinite(lat) ? lat : 0;
  const safeLng = Number.isFinite(lng) ? lng : 0;

  const embedUrl = useMemo(() => buildOsmEmbedUrl(safeLat, safeLng, zoom), [safeLat, safeLng, zoom]);
  const openUrl = useMemo(() => buildOsmOpenUrl(safeLat, safeLng, zoom), [safeLat, safeLng, zoom]);

  return (
    <div className={className}>
      <div className="overflow-hidden rounded-2xl ring-1 ring-slate-200/70 bg-slate-50">
        <iframe
          title={label ? `Map: ${label}` : "Map"}
          src={embedUrl}
          style={{ height }}
          className="w-full"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-600">
        <div className="truncate">
          {label ? label : `${safeLat.toFixed(5)}, ${safeLng.toFixed(5)}`}
        </div>
        <a
          href={openUrl}
          target="_blank"
          rel="noreferrer"
          className="text-blue-700 hover:underline flex-shrink-0"
        >
          Open map
        </a>
      </div>
    </div>
  );
}

