"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { authHeader } from "@/lib/authToken";
import type * as Leaflet from "leaflet";

type GeoCoords = { lat: number; lng: number };

type LiveLocation = {
  userId: string;
  username: string;
  lat: number;
  lng: number;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  updatedAt: string;
  isMe: boolean;
};

type DeviceFix = {
  lat: number;
  lng: number;
  accuracy: number | null;
  at: number;
};

const MAX_ACCEPTABLE_ACCURACY_M = 1500;

type Props = {
  baseUrl: string;
  eventId: string;
  eventCenter: GeoCoords;
  eventLabel?: string;
  height?: number;
  pollSeconds?: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function safeBaseUrl(url: string) {
  return String(url || "").trim().replace(/\/+$/, "");
}

function escapeHtml(input: string) {
  return String(input || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type LeafletNamespace = typeof import("leaflet");

function isLeafletNamespace(value: unknown): value is LeafletNamespace {
  if (!value || typeof value !== "object") return false;
  return "map" in value && typeof (value as { map?: unknown }).map === "function";
}

async function loadLeaflet(): Promise<LeafletNamespace> {
  const mod = await import("leaflet");
  if (isLeafletNamespace(mod)) return mod;
  const maybeDefault = (mod as unknown as { default?: unknown }).default;
  if (isLeafletNamespace(maybeDefault)) return maybeDefault;
  throw new Error("Failed to load Leaflet");
}

export default function LivePlayersMap({
  baseUrl,
  eventId,
  eventCenter,
  eventLabel,
  height = 320,
  pollSeconds = 3,
}: Props) {
  const base = useMemo(() => safeBaseUrl(baseUrl), [baseUrl]);

  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gpsWarning, setGpsWarning] = useState<string | null>(null);
  const [locations, setLocations] = useState<LiveLocation[]>([]);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [deviceFix, setDeviceFix] = useState<DeviceFix | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const leafletRef = useRef<LeafletNamespace | null>(null);
  const eventMarkerRef = useRef<Leaflet.Marker | null>(null);
  const markersRef = useRef<Map<string, Leaflet.Marker>>(new Map());
  const autoFitRef = useRef(false);
  const watchIdRef = useRef<number | null>(null);

  const inFlightRef = useRef(false);
  const queuedPayloadRef = useRef<Record<string, unknown> | null>(null);
  const throttleTimerRef = useRef<number | null>(null);
  const lastSentAtRef = useRef(0);
  const unmountedRef = useRef(false);

  const fetchLiveLocations = useCallback(async () => {
    if (!base || !eventId) return;
    try {
      const res = await fetch(`${base}/api/events/${encodeURIComponent(eventId)}/live-locations`, {
        headers: authHeader(),
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Failed to load live locations (${res.status})`);
      }
      const data = (await res.json()) as { locations?: LiveLocation[] };
      setLocations(Array.isArray(data.locations) ? data.locations : []);
      setLastSyncAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load live locations");
    }
  }, [base, eventId]);

  const fitPlayers = useCallback(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    const points: Array<[number, number]> = [
      [eventCenter.lat, eventCenter.lng],
      ...locations.map((l) => [l.lat, l.lng] as [number, number]),
    ];

    if (points.length <= 1) {
      map.setView([eventCenter.lat, eventCenter.lng], 16);
      return;
    }

    const bounds = L.latLngBounds(points);
    try {
      map.fitBounds(bounds, { padding: [44, 44], maxZoom: 17 });
    } catch {
      map.setView([eventCenter.lat, eventCenter.lng], 16);
    }
  }, [eventCenter.lat, eventCenter.lng, locations]);

  const flushQueued = useCallback(async () => {
    if (!base || !eventId) return;
    if (inFlightRef.current) return;

    const toSend = queuedPayloadRef.current;
    queuedPayloadRef.current = null;
    if (!toSend) return;

    inFlightRef.current = true;
    try {
      const res = await fetch(`${base}/api/events/${encodeURIComponent(eventId)}/live-location`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeader() },
        credentials: "include",
        body: JSON.stringify(toSend),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Failed to update location (${res.status})`);
      }
      lastSentAtRef.current = Date.now();
      void fetchLiveLocations(); // show me ASAP (don’t wait for the next poll)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update location");
    } finally {
      inFlightRef.current = false;
      if (queuedPayloadRef.current) void flushQueued();
    }
  }, [base, eventId, fetchLiveLocations]);

  const scheduleFlush = useCallback(() => {
    if (throttleTimerRef.current != null) return;

    const elapsed = Date.now() - lastSentAtRef.current;
    const delay = elapsed < 1200 ? 1200 - elapsed : 0;
    throttleTimerRef.current = window.setTimeout(() => {
      throttleTimerRef.current = null;
      if (unmountedRef.current) return;
      void flushQueued();
    }, delay);
  }, [flushQueued]);

  const sendLiveLocation = useCallback(
    (payload: Record<string, unknown>) => {
      if (!base || !eventId) return;
      queuedPayloadRef.current = payload;
      scheduleFlush();
    },
    [base, eventId, scheduleFlush]
  );

  const stopSharing = useCallback(async () => {
    if (watchIdRef.current != null && typeof navigator !== "undefined" && "geolocation" in navigator) {
      try {
        navigator.geolocation.clearWatch(watchIdRef.current);
      } catch {
        // ignore
      }
    }
    watchIdRef.current = null;
    setSharing(false);
    setGpsWarning(null);

    if (!base || !eventId) return;
    try {
      await fetch(`${base}/api/events/${encodeURIComponent(eventId)}/live-location`, {
        method: "DELETE",
        headers: authHeader(),
        credentials: "include",
      });
    } catch {
      // ignore
    }
  }, [base, eventId]);

  const handlePosition = useCallback(
    (pos: GeolocationPosition) => {
      const lat = pos.coords?.latitude;
      const lng = pos.coords?.longitude;
      if (typeof lat !== "number" || typeof lng !== "number") return;

      const accuracy = typeof pos.coords?.accuracy === "number" ? pos.coords.accuracy : null;
      const fix = {
        lat: clamp(lat, -90, 90),
        lng: clamp(lng, -180, 180),
        accuracy,
        at: Date.now(),
      };
      setDeviceFix(fix);

      // If we only have a coarse location (IP/cell-tower), don't broadcast it as "live".
      if (accuracy != null && Number.isFinite(accuracy) && accuracy > MAX_ACCEPTABLE_ACCURACY_M) {
        setGpsWarning(`Low GPS accuracy (±${Math.round(accuracy)}m). Enable “Precise location” and try again.`);
        return;
      }

      setGpsWarning(null);
      void sendLiveLocation({
        lat: fix.lat,
        lng: fix.lng,
        accuracy: fix.accuracy ?? undefined,
        heading: pos.coords?.heading ?? undefined,
        speed: pos.coords?.speed ?? undefined,
      });
    },
    [sendLiveLocation]
  );

  const startSharing = useCallback(() => {
    setError(null);
    setGpsWarning(null);
    if (!base || !eventId) {
      setError("Missing backend URL");
      return;
    }
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setError("Geolocation is not supported on this device/browser");
      return;
    }

    try {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
    } catch {
      // ignore
    }

    // First fix: request a current GPS reading (some browsers return an old/cached watch fix initially)
    navigator.geolocation.getCurrentPosition(
      handlePosition,
      () => {
        // ignore; watchPosition below will surface errors
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 }
    );

    const watchId = navigator.geolocation.watchPosition(
      handlePosition,
      (err) => {
        setError(err?.message || "Failed to read device location");
        void stopSharing();
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 }
    );

    watchIdRef.current = watchId;
    setSharing(true);
    autoFitRef.current = false;
  }, [base, eventId, handlePosition, stopSharing]);

  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      if (throttleTimerRef.current != null) window.clearTimeout(throttleTimerRef.current);
      void stopSharing();
    };
  }, [stopSharing]);

  useEffect(() => {
    if (!base || !eventId) return;
    void fetchLiveLocations();

    const pollMs = clamp(Math.round(pollSeconds * 1000), 1000, 15_000);
    const t = window.setInterval(() => void fetchLiveLocations(), pollMs);
    return () => window.clearInterval(t);
  }, [base, eventId, fetchLiveLocations, pollSeconds]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!containerRef.current) return;
      if (mapRef.current) return;

      const L = await loadLeaflet();
      if (cancelled) return;

      leafletRef.current = L;
      const map = L.map(containerRef.current, {
        zoomControl: true,
        attributionControl: true,
      });
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      const eventIcon = L.divIcon({
        className: "",
        html: '<div class="app-event-marker"><div class="app-event-marker__dot"></div></div>',
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });

      eventMarkerRef.current = L.marker([eventCenter.lat, eventCenter.lng], { icon: eventIcon })
        .addTo(map)
        .bindTooltip(escapeHtml(eventLabel || "Event"), { direction: "top", offset: [0, -8] });

      map.setView([eventCenter.lat, eventCenter.lng], 16);
    }

    void init();

    return () => {
      cancelled = true;
      try {
        if (mapRef.current) mapRef.current.remove();
      } catch {
        // ignore
      }
      mapRef.current = null;
      eventMarkerRef.current = null;
      markersRef.current.clear();
    };
  }, [eventCenter.lat, eventCenter.lng, eventLabel]);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    const seen = new Set<string>();
    for (const loc of locations) {
      if (!loc || !loc.userId) continue;
      seen.add(loc.userId);

      const isMe = Boolean(loc.isMe);
      const label = escapeHtml(loc.username || "Player");
      const playerIcon = L.divIcon({
        className: "",
        html: `<div class="app-live-marker ${isMe ? "app-live-marker--me" : ""}">
  <div class="app-live-marker__pulse"></div>
  <div class="app-live-marker__dot"></div>
  <div class="app-live-marker__label">${label}</div>
</div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });

      const existing = markersRef.current.get(loc.userId);
      if (existing) {
        existing.setLatLng([loc.lat, loc.lng]);
      } else {
        const m = L.marker([loc.lat, loc.lng], { icon: playerIcon }).addTo(map);
        markersRef.current.set(loc.userId, m);
      }
    }

    for (const [userId, marker] of markersRef.current.entries()) {
      if (!seen.has(userId)) {
        try {
          marker.remove();
        } catch {
          // ignore
        }
        markersRef.current.delete(userId);
      }
    }

    if (!autoFitRef.current && locations.length) {
      autoFitRef.current = true;
      fitPlayers();
    }
  }, [fitPlayers, locations]);

  const recenter = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setView([eventCenter.lat, eventCenter.lng], 16);
  }, [eventCenter.lat, eventCenter.lng]);

  const playersOnline = locations.length;
  const subtitle = lastSyncAt
    ? `Live now: ${playersOnline} • updated ${Math.max(0, Math.round((Date.now() - lastSyncAt) / 1000))}s ago`
    : `Live now: ${playersOnline}`;

  const myServerFix = useMemo(() => locations.find((l) => l.isMe) ?? null, [locations]);

  return (
    <div className="rounded-2xl bg-white/70 ring-1 ring-slate-200/70 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-900">Live players map</div>
          <div className="mt-1 text-xs text-slate-600">{subtitle}</div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={recenter}
            className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50"
          >
            Recenter
          </button>
          <button
            type="button"
            onClick={fitPlayers}
            className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50"
          >
            Fit players
          </button>
          <button
            type="button"
            onClick={() => (sharing ? void stopSharing() : startSharing())}
            className={[
              "rounded-xl px-3 py-2 text-xs font-semibold ring-1",
              sharing
                ? "bg-emerald-50 text-emerald-800 ring-emerald-200 hover:bg-emerald-100"
                : "bg-blue-50 text-blue-800 ring-blue-200 hover:bg-blue-100",
            ].join(" ")}
          >
            {sharing ? "Sharing my location" : "I'm here (share live)"}
          </button>
        </div>
      </div>

      {error ? <div className="mt-3 text-xs text-rose-700">{error}</div> : null}
      {gpsWarning ? <div className="mt-3 text-xs text-amber-800">{gpsWarning}</div> : null}

      <div className="mt-4 overflow-hidden rounded-2xl ring-1 ring-slate-200/70 bg-slate-50">
        <div ref={containerRef} style={{ height }} />
      </div>

      {sharing ? (
        <div className="mt-3 grid gap-1 text-[11px] text-slate-600">
          <div>
            <span className="text-slate-500">Device:</span>{" "}
            {deviceFix
              ? `${deviceFix.lat.toFixed(5)}, ${deviceFix.lng.toFixed(5)} (±${Math.round(
                  deviceFix.accuracy ?? 0
                )}m) • ${Math.max(0, Math.round((Date.now() - deviceFix.at) / 1000))}s ago`
              : "waiting for GPS…"}
          </div>
          <div>
            <span className="text-slate-500">Server:</span>{" "}
            {myServerFix
              ? `${myServerFix.lat.toFixed(5)}, ${myServerFix.lng.toFixed(5)} • ${new Date(
                  myServerFix.updatedAt
                ).toLocaleTimeString()}`
              : "not received yet…"}
          </div>
        </div>
      ) : null}

      <div className="mt-3 text-xs text-slate-600">
        Tip: if you don’t see your marker, press “Fit players” (you may be far from the event pin).
      </div>
    </div>
  );
}
