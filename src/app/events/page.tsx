"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authHeader } from "@/lib/authToken";
import MapPreview from "@/components/MapPreview";
import LivePlayersMap from "@/components/LivePlayersMap";

type GeoCoords = { lat: number; lng: number };
type GeoResult = { displayName: string; lat: number; lng: number };

type EventItem = {
  id: string;
  title: string;
  description?: string;
  sport?: string;
  startsAt: string;
  locationName?: string;
  locationCoords?: GeoCoords | null;
  visibility: "public" | "friends";
  maxParticipants: number;
  participantsCount: number;
  joined: boolean;
  owner: boolean;
  createdBy?: { id: string; username?: string; email?: string };
};

async function readJsonOrText(res: Response): Promise<{ isJson: boolean; body: unknown }> {
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return { isJson: true, body: await res.json() };
  }
  return { isJson: false, body: await res.text() };
}

function messageFromBody(parsed: { isJson: boolean; body: unknown }): string | null {
  if (parsed.isJson && parsed.body && typeof parsed.body === "object") {
    const anyBody = parsed.body as { message?: unknown; error?: unknown };
    if (typeof anyBody.message === "string" && anyBody.message.trim()) return anyBody.message;
    if (typeof anyBody.error === "string" && anyBody.error.trim()) return anyBody.error;
    return null;
  }
  if (!parsed.isJson && typeof parsed.body === "string") {
    const text = parsed.body
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return text || null;
  }
  return null;
}

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export default function EventsPage() {
  const router = useRouter();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [justCreatedEventId, setJustCreatedEventId] = useState<string | null>(null);
  const [vibrateIndex, setVibrateIndex] = useState<number>(0);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  // Create form
  const [title, setTitle] = useState("");
  const [sport, setSport] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [visibility, setVisibility] = useState<"public" | "friends">("public");
  const [maxParticipants, setMaxParticipants] = useState<number>(10);
  const [description, setDescription] = useState("");

  // Location picker (same style as signup)
  const [locationName, setLocationName] = useState("");
  const [locationCoords, setLocationCoords] = useState<GeoCoords | null>(null);
  const [geoResults, setGeoResults] = useState<GeoResult[]>([]);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoOpen, setGeoOpen] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const creatingRef = useRef(false);
  const joiningRef = useRef<string | null>(null);

  const base = String(process.env.NEXT_PUBLIC_BACKEND_URL || "").trim().replace(/\/+$/, "");

  const refresh = useCallback(async () => {
    if (!base) return;
    setError(null);
    const res = await fetch(`${base}/api/events`, { credentials: "include", headers: authHeader() });
    if (res.status === 401) {
      router.push("/auth/login");
      return;
    }
    const parsed = await readJsonOrText(res);
    if (!res.ok) {
      throw new Error(messageFromBody(parsed) || "Failed to load events");
    }
    if (!parsed.isJson) throw new Error("Unexpected server response");
    const data = parsed.body as { events?: EventItem[] };
    setEvents(Array.isArray(data.events) ? data.events : []);
  }, [base, router]);

  useEffect(() => {
    if (!justCreatedEventId) return;
    const el = document.querySelector<HTMLElement>(`[data-event-id="${CSS.escape(justCreatedEventId)}"]`);
    if (el) {
      try {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      } catch {
        el.scrollIntoView();
      }
    }
    const t = window.setTimeout(() => setJustCreatedEventId(null), 1400);
    return () => window.clearTimeout(t);
  }, [justCreatedEventId]);

  useEffect(() => {
    if (events.length <= 1) {
      setVibrateIndex(0);
      return;
    }

    setVibrateIndex(0);
    const t = window.setInterval(() => {
      setVibrateIndex((prev) => (events.length ? (prev + 1) % events.length : 0));
    }, 2000);

    return () => window.clearInterval(t);
  }, [events.length]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await refresh();
      } catch (e: unknown) {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : "Failed to load events");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [refresh]);

  useEffect(() => {
    if (!geoOpen) return;
    const q = locationName.trim();
    if (q.length < 3) {
      setGeoResults([]);
      setGeoError(null);
      return;
    }

    setGeoLoading(true);
    setGeoError(null);
    const controller = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/geo/search?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then(async (r) => {
          if (!r.ok) throw new Error("Search failed");
          const data = (await r.json()) as { results?: GeoResult[] };
          setGeoResults(Array.isArray(data.results) ? data.results : []);
        })
        .catch((e: unknown) => {
          if (e instanceof DOMException && e.name === "AbortError") return;
          setGeoResults([]);
          setGeoError("Could not load location suggestions");
        })
        .finally(() => setGeoLoading(false));
    }, 350);

    return () => {
      controller.abort();
      clearTimeout(t);
    };
  }, [geoOpen, locationName]);

  const selectGeo = (item: GeoResult) => {
    setLocationName(item.displayName);
    setLocationCoords({ lat: item.lat, lng: item.lng });
    setGeoOpen(false);
    setGeoResults([]);
  };

  const canCreate = useMemo(() => {
    if (!title.trim()) return false;
    if (!startsAt) return false;
    return true;
  }, [startsAt, title]);

  const createEvent = async () => {
    if (!base) {
      setError("Missing NEXT_PUBLIC_BACKEND_URL");
      return;
    }
    if (!canCreate) return;
    if (creatingRef.current) return;
    creatingRef.current = true;
    setError(null);

    try {
      const res = await fetch(`${base}/api/events`, {
        method: "POST",
        headers: { ...authHeader(), "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title,
          sport,
          startsAt,
          visibility,
          maxParticipants,
          description,
          locationName,
          locationCoords,
        }),
      });

      if (res.status === 401) {
        router.push("/auth/login");
        return;
      }

      const parsed = await readJsonOrText(res);
      if (!res.ok) throw new Error(messageFromBody(parsed) || "Failed to create event");

      let createdId: string | null = null;
      if (parsed.isJson && parsed.body && typeof parsed.body === "object") {
        const body = parsed.body as { event?: { id?: unknown } };
        const raw = body?.event?.id;
        if (typeof raw === "string" && raw.trim()) createdId = raw;
      }

      setTitle("");
      setSport("");
      setStartsAt("");
      setVisibility("public");
      setMaxParticipants(10);
      setDescription("");
      setLocationName("");
      setLocationCoords(null);
      setGeoResults([]);
      setGeoOpen(false);
      await refresh();
      if (createdId) {
        setJustCreatedEventId(createdId);
        setExpandedEventId(createdId);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create event");
    } finally {
      creatingRef.current = false;
    }
  };

  const joinOrLeave = async (ev: EventItem) => {
    if (!base) {
      setError("Missing NEXT_PUBLIC_BACKEND_URL");
      return;
    }
    if (joiningRef.current) return;
    joiningRef.current = ev.id;
    setError(null);
    try {
      const action = ev.joined ? "leave" : "join";
      const res = await fetch(`${base}/api/events/${encodeURIComponent(ev.id)}/${action}`, {
        method: "POST",
        credentials: "include",
        headers: authHeader(),
      });
      if (res.status === 401) {
        router.push("/auth/login");
        return;
      }
      const parsed = await readJsonOrText(res);
      if (!res.ok) throw new Error(messageFromBody(parsed) || "Action failed");
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      joiningRef.current = null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-gray-600">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-full">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Events</h1>
            <div className="text-sm text-gray-600">Create a practice session or match and let others join.</div>
          </div>
          <button
            type="button"
            onClick={() => router.push("/find-partner?stay=1")}
            className="rounded-xl bg-white/70 ring-1 ring-slate-200/70 px-4 py-2 text-sm text-gray-900 hover:bg-white backdrop-blur"
          >
            Back
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-2xl bg-red-50/70 ring-1 ring-red-200/70 px-4 py-3 text-sm text-red-800 backdrop-blur">
            {error}
          </div>
        )}

        <div className="mt-5 rounded-2xl bg-white/80 ring-1 ring-slate-200/70 shadow-sm overflow-hidden backdrop-blur">
          <div className="px-4 py-3 border-b border-slate-200/70 bg-gradient-to-r from-white to-slate-50">
            <div className="text-sm font-semibold text-gray-900">Create event</div>
          </div>
          <div className="p-4 grid gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-800">Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Practice session"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-blue-200 focus:ring"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-800">Sport</label>
                <input
                  value={sport}
                  onChange={(e) => setSport(e.target.value)}
                  placeholder="Badminton"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-blue-200 focus:ring"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-800">Date & time</label>
                <input
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-blue-200 focus:ring"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-800">Max participants</label>
                <input
                  type="number"
                  min={2}
                  max={100}
                  value={maxParticipants}
                  onChange={(e) => setMaxParticipants(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-blue-200 focus:ring"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-800">Location</label>
              <div className="relative mt-1">
                <input
                  value={locationName}
                  onChange={(e) => {
                    setLocationName(e.target.value);
                    setLocationCoords(null);
                    setGeoOpen(true);
                  }}
                  onFocus={() => setGeoOpen(true)}
                  onBlur={() => setTimeout(() => setGeoOpen(false), 150)}
                  placeholder="Search a place (optional)"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 pr-10 outline-none ring-blue-200 focus:ring"
                />
                <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-400">
                  ⌕
                </div>

                {geoOpen && (geoLoading || geoResults.length > 0 || geoError) && (
                  <div className="absolute z-10 mt-2 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
                    {geoError && <div className="px-3 py-2 text-sm text-red-700">{geoError}</div>}
                    {geoLoading && <div className="px-3 py-2 text-sm text-gray-600">Searching...</div>}
                    {!geoLoading && !geoError && geoResults.length === 0 && (
                      <div className="px-3 py-2 text-sm text-gray-600">No results.</div>
                    )}
                    {!geoLoading &&
                      !geoError &&
                      geoResults.map((r) => (
                        <button
                          key={`${r.lat},${r.lng},${r.displayName}`}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => selectGeo(r)}
                          className="block w-full px-3 py-2 text-left text-sm text-gray-800 hover:bg-gray-50"
                        >
                          {r.displayName}
                        </button>
                      ))}
                  </div>
                )}
              </div>
              <div className="mt-1 text-xs text-gray-500">
                {locationCoords
                  ? `Saved coordinates: ${locationCoords.lat.toFixed(5)}, ${locationCoords.lng.toFixed(5)}`
                  : "Pick a suggestion to save coordinates."}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-800">Visibility</label>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setVisibility("public")}
                  className={[
                    "rounded-xl border px-3 py-2 text-sm transition",
                    visibility === "public"
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-slate-200 bg-white text-gray-800 hover:bg-slate-50",
                  ].join(" ")}
                >
                  Public
                </button>
                <button
                  type="button"
                  onClick={() => setVisibility("friends")}
                  className={[
                    "rounded-xl border px-3 py-2 text-sm transition",
                    visibility === "friends"
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-slate-200 bg-white text-gray-800 hover:bg-slate-50",
                  ].join(" ")}
                >
                  Friends only
                </button>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-800">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional details (time, court, rules, etc.)"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-blue-200 focus:ring min-h-[90px]"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={createEvent}
                disabled={!canCreate}
                className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm text-white shadow-sm hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60"
              >
                Create event
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl bg-white/80 ring-1 ring-slate-200/70 shadow-sm overflow-hidden backdrop-blur">
          <div className="px-4 py-3 border-b border-slate-200/70 bg-gradient-to-r from-white to-slate-50 flex items-center justify-between">
            <div className="text-sm font-semibold text-gray-900">Upcoming events</div>
            <div className="text-xs text-gray-500">{events.length}</div>
          </div>

          {events.length === 0 ? (
            <div className="p-4 text-sm text-gray-600">No events yet.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {events.map((ev, idx) => {
                const disabled = joiningRef.current === ev.id || (ev.owner && ev.joined);
                const justCreated = ev.id === justCreatedEventId;
                const shouldVibrate = !justCreated && idx === vibrateIndex;
                const coords = ev.locationCoords;
                const hasCoords =
                  Boolean(coords) &&
                  Number.isFinite(coords?.lat) &&
                  Number.isFinite(coords?.lng);
                const expanded = expandedEventId === ev.id;
                return (
                  <div
                    key={ev.id}
                    data-event-id={ev.id}
                    className={[
                      "p-4 transition",
                      justCreated
                        ? "app-jump-in app-glow-pulse bg-blue-50/40 ring-1 ring-blue-200/70"
                        : expanded
                          ? "bg-white/60 ring-1 ring-slate-200/70"
                          : "hover:bg-white/60",
                    ].join(" ")}
                  >
                    <div className={shouldVibrate ? "app-vibrate" : ""}>
                      <div
                        className="flex items-start justify-between gap-4 cursor-pointer select-none"
                        role="button"
                        tabIndex={0}
                        aria-expanded={expanded}
                        onClick={() => setExpandedEventId(expanded ? null : ev.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setExpandedEventId(expanded ? null : ev.id);
                          }
                        }}
                      >
                        <div className="min-w-0 flex-1 text-left">
                          <div className="font-semibold text-gray-900">{ev.title}</div>
                          <div className="mt-0.5 text-xs text-gray-600 flex flex-wrap gap-x-2 gap-y-1">
                            {ev.sport ? <span>🏅 {ev.sport}</span> : null}
                            <span>🕒 {formatWhen(ev.startsAt)}</span>
                            {ev.locationName ? <span>📍 {ev.locationName}</span> : null}
                            <span>
                              👥 {ev.participantsCount}/{ev.maxParticipants}
                            </span>
                            <span className="capitalize">🔒 {ev.visibility}</span>
                          </div>
                          {ev.description ? (
                            <div className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">
                              {ev.description}
                            </div>
                          ) : null}
                          <div className="mt-2 text-xs text-blue-700">
                            {expanded ? "Hide details" : "View details"}
                          </div>
                        </div>

                        <div className="flex-shrink-0 flex flex-col items-end gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              joinOrLeave(ev);
                            }}
                            disabled={disabled}
                            className={[
                              "rounded-xl px-4 py-2 text-sm shadow-sm disabled:opacity-60",
                              ev.owner
                                ? "bg-slate-100 text-slate-900"
                                : ev.joined
                                  ? "bg-slate-100 text-slate-900 hover:bg-slate-200"
                                  : "bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700",
                            ].join(" ")}
                          >
                            {joiningRef.current === ev.id
                              ? "Please wait…"
                              : ev.owner
                                ? "Creator"
                                : ev.joined
                                  ? "Leave"
                                  : "Join"}
                          </button>
                          {ev.createdBy?.username ? (
                            <div className="text-xs text-gray-500">by {ev.createdBy.username}</div>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    {expanded ? (
                      <div className="mt-4 app-jump-in">
                        <div className="rounded-2xl bg-white/70 ring-1 ring-slate-200/70 p-4">
                          <div className="text-sm font-semibold text-slate-900">Event details</div>
                          <div className="mt-2 grid gap-1 text-sm text-slate-700">
                            <div>
                              <span className="text-slate-500">When:</span> {formatWhen(ev.startsAt)}
                            </div>
                            {ev.sport ? (
                              <div>
                                <span className="text-slate-500">Sport:</span> {ev.sport}
                              </div>
                            ) : null}
                            {ev.locationName ? (
                              <div>
                                <span className="text-slate-500">Location:</span> {ev.locationName}
                              </div>
                            ) : null}
                            <div>
                              <span className="text-slate-500">Visibility:</span> {ev.visibility}
                            </div>
                            <div>
                              <span className="text-slate-500">Participants:</span>{" "}
                              {ev.participantsCount}/{ev.maxParticipants}
                            </div>
                          </div>

                          {hasCoords ? (
                            <div className="mt-4">
                              <MapPreview
                                lat={coords!.lat}
                                lng={coords!.lng}
                                label={ev.locationName?.trim() || ev.title}
                                height={260}
                              />
                            </div>
                          ) : (
                            <div className="mt-4 text-sm text-slate-600">
                              No map available for this event (missing coordinates).
                            </div>
                          )}

                          {hasCoords ? (
                            ev.joined ? (
                              <div className="mt-4">
                                <LivePlayersMap
                                  baseUrl={base}
                                  eventId={ev.id}
                                  eventCenter={coords!}
                                  eventLabel={ev.locationName?.trim() || ev.title}
                                  height={320}
                                />
                              </div>
                            ) : (
                              <div className="mt-4 text-sm text-slate-600">
                                Join this event to share your live location and see other arrived players.
                              </div>
                            )
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
                  </div>
                )}
              </div>
              {locationCoords ? (
                <div className="mt-3">
                  <MapPreview
                    lat={locationCoords.lat}
                    lng={locationCoords.lng}
                    label={locationName.trim() || "Event location"}
                    className="app-jump-in"
                  />
                </div>
              ) : locationName.trim() ? (
                <div className="mt-2 text-xs text-slate-600">
                  Select a location suggestion to preview it on the map.
                </div>
              ) : null}
            </div>
    </div>
  );
}
