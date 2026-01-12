"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import UserAvatar from "@/components/UserAvatar";
import { authHeader } from "@/lib/authToken";

type Partner = {
  _id?: string;
  id?: string;
  email?: string;
  username?: string;
  fullName?: string;
  skill?: string;
  location?: string;
  mutual?: number;
  distanceMeters?: number;
};

type FriendRequest = {
  from: Partner;
  createdAt: number;
};

function partnerId(p: Partner): string {
  return String(p._id ?? p.id ?? "");
}

function displayName(p: Partner): string {
  return p.username ?? p.fullName ?? p.email ?? "Unknown";
}

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

export default function FindPartner() {
  const router = useRouter();
  const [stayOnFindPartner, setStayOnFindPartner] = useState(false);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [friends, setFriends] = useState<Partner[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [friendsOpen, setFriendsOpen] = useState(true);
  const [requestsOpen, setRequestsOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startingChatId, setStartingChatId] = useState<string | null>(null);
  const [addingFriendId, setAddingFriendId] = useState<string | null>(null);
  const [acceptingFriendId, setAcceptingFriendId] = useState<string | null>(null);

  // Prevent double fetch (React Strict Mode mounts component twice in dev)
  const fetchedRef = useRef(false);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      setStayOnFindPartner(params.get("stay") === "1");
    } catch {
      setStayOnFindPartner(false);
    }
  }, []);

  useEffect(() => {
    if (stayOnFindPartner) return;
    router.replace("/feed");
  }, [router, stayOnFindPartner]);

  const refreshFriends = useCallback(async () => {
    const base = String(process.env.NEXT_PUBLIC_BACKEND_URL || "").trim().replace(/\/+$/, "");
    if (!base) return;

    const headers = authHeader();
    const [friendsRes, requestsRes] = await Promise.all([
      fetch(`${base}/api/friends`, { credentials: "include", headers }),
      fetch(`${base}/api/friends/requests`, { credentials: "include", headers }),
    ]);

    if (friendsRes.status === 401 || requestsRes.status === 401) {
      router.push("/auth/login");
      return;
    }

    if (friendsRes.ok) {
      const parsed = await readJsonOrText(friendsRes);
      if (parsed.isJson) {
        const data = parsed.body as { friends?: Partner[] };
        setFriends((data?.friends ?? []) as Partner[]);
      }
    }

    if (requestsRes.ok) {
      const parsed = await readJsonOrText(requestsRes);
      if (parsed.isJson) {
        const data = parsed.body as { requests?: FriendRequest[] };
        setRequests((data?.requests ?? []) as FriendRequest[]);
      }
    }
  }, [router]);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    const fetchPartners = async () => {
      try {
        const base = String(process.env.NEXT_PUBLIC_BACKEND_URL || "").trim().replace(/\/+$/, "");
        if (!base) throw new Error("Missing NEXT_PUBLIC_BACKEND_URL");
        const url = `${base}/api/partners/find-partner`;
        console.debug("FindPartner: fetching", url);
        const res = await fetch(url, { credentials: "include", headers: authHeader() });

        if (res.status === 401) {
          router.push("/auth/login");
          return;
        }

        if (!res.ok) throw new Error(await res.text());

        const data = await res.json();
        console.debug("FindPartner: fetched partners", data);
        setPartners((data?.partners ?? data ?? []) as Partner[]);
        await refreshFriends();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load partners");
      } finally {
        setLoading(false);
      }
    };

    fetchPartners();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Find-or-create conversation, then navigate
  const startChat = useCallback(
    async (partnerId: string, partnerName?: string) => {
      if (!partnerId) return;
      setStartingChatId(partnerId);
      const nameQuery = partnerName ? `?name=${encodeURIComponent(partnerName)}` : "";
      router.push(`/chat/${encodeURIComponent(partnerId)}${nameQuery}`);
      setStartingChatId(null);
    },
    [router]
  );

  const addFriend = useCallback(
    async (targetUserId: string) => {
      const base = String(process.env.NEXT_PUBLIC_BACKEND_URL || "").trim().replace(/\/+$/, "");
      if (!base) {
        setError("Missing NEXT_PUBLIC_BACKEND_URL");
        return;
      }
      if (!targetUserId) return;

      setAddingFriendId(targetUserId);
      setError(null);
      try {
        const res = await fetch(`${base}/api/friends/request`, {
          method: "POST",
          headers: { ...authHeader(), "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ userId: targetUserId }),
        });

        if (res.status === 401) {
          router.push("/auth/login");
          return;
        }

        const parsed = await readJsonOrText(res);
        if (!res.ok) throw new Error(messageFromBody(parsed) || "Failed to add friend");
        if (!parsed.isJson) throw new Error(messageFromBody(parsed) || "Unexpected server response");

        setPartners((prev) => prev.filter((p) => partnerId(p) !== targetUserId));
        await refreshFriends();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to add friend");
      } finally {
        setAddingFriendId(null);
      }
    },
    [refreshFriends, router]
  );

  const acceptFriend = useCallback(
    async (fromUserId: string) => {
      const base = String(process.env.NEXT_PUBLIC_BACKEND_URL || "").trim().replace(/\/+$/, "");
      if (!base) {
        setError("Missing NEXT_PUBLIC_BACKEND_URL");
        return;
      }
      if (!fromUserId) return;

      setAcceptingFriendId(fromUserId);
      setError(null);
      try {
        const res = await fetch(`${base}/api/friends/accept`, {
          method: "POST",
          headers: { ...authHeader(), "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ userId: fromUserId }),
        });

        if (res.status === 401) {
          router.push("/auth/login");
          return;
        }

        const parsed = await readJsonOrText(res);
        if (!res.ok) throw new Error(messageFromBody(parsed) || "Failed to accept request");
        if (!parsed.isJson) throw new Error(messageFromBody(parsed) || "Unexpected server response");

        await refreshFriends();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to accept request");
      } finally {
        setAcceptingFriendId(null);
      }
    },
    [refreshFriends, router]
  );

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-gray-600">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-full">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left sidebar */}
          <aside className="lg:col-span-3">
            <div className="lg:sticky lg:top-4 space-y-4">
              <div className="rounded-2xl bg-white/80 ring-1 ring-slate-200/70 shadow-sm overflow-hidden backdrop-blur">
                <div className="px-4 py-3 border-b border-slate-200/70 bg-gradient-to-r from-white to-slate-50">
                  <div className="text-sm font-semibold text-gray-900">Menu</div>
                </div>
                <div className="p-2">
                  <button
                    type="button"
                    onClick={() => router.push("/find-partner?stay=1")}
                    className="w-full text-left rounded-xl px-3 py-2 text-sm text-gray-800 hover:bg-slate-50"
                  >
                    Find partners
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push("/chat")}
                    className="w-full text-left rounded-xl px-3 py-2 text-sm text-gray-800 hover:bg-slate-50"
                  >
                    Chats
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push("/events")}
                    className="w-full text-left rounded-xl px-3 py-2 text-sm text-gray-800 hover:bg-slate-50"
                  >
                    Events
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push("/profile")}
                    className="w-full text-left rounded-xl px-3 py-2 text-sm text-gray-800 hover:bg-slate-50"
                  >
                    Profile
                  </button>
                </div>
              </div>

              {error && (
                <div className="rounded-2xl bg-red-50/70 ring-1 ring-red-200/70 px-4 py-3 text-sm text-red-800 backdrop-blur">
                  {error}
                </div>
              )}
            </div>
          </aside>

          {/* Center feed */}
          <main className="lg:col-span-6 space-y-4">
            <div className="rounded-2xl bg-white/80 ring-1 ring-slate-200/70 shadow-sm overflow-hidden backdrop-blur">
              <div className="px-4 py-3 border-b border-slate-200/70 flex items-center justify-between bg-gradient-to-r from-white to-slate-50">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">People you may want to play with</h2>
                  <div className="text-xs text-gray-600">Suggestions based on your profile</div>
                </div>
                <div className="text-xs text-gray-500">{partners.length} shown</div>
              </div>

              {partners.length === 0 ? (
                <div className="p-4 text-sm text-gray-600">No suggestions right now.</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {partners.map((p) => {
                    const key = p._id ?? p.id ?? p.email ?? cryptoRandomKey();
                    const name = displayName(p);
                    const id = partnerId(p);
                    const canMessage = !!id && friends.some((f) => partnerId(f) === id);
                    const distance =
                      typeof p.distanceMeters === "number"
                        ? formatDistance(p.distanceMeters)
                        : null;

                    return (
                      <div key={key} className="p-4 flex gap-3 hover:bg-white/60 transition">
                        <div className="flex-shrink-0">
                          {id ? (
                            <UserAvatar userId={id} name={name} size={44} />
                          ) : (
                            <div className="w-11 h-11 rounded-full bg-gray-200 flex items-center justify-center text-sm font-semibold text-gray-700">
                              {initials(name)}
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-semibold text-gray-900 truncate">{name}</div>
                              <div className="mt-0.5 text-xs text-gray-600 flex flex-wrap gap-x-2 gap-y-1">
                                {p.skill && <span>🎯 {p.skill}</span>}
                                {p.location && <span>📍 {p.location}</span>}
                                {distance && <span>🛣️ {distance}</span>}
                              </div>
                              {typeof p.mutual === "number" && (
                                <div className="mt-1 text-xs text-gray-600">
                                  {p.mutual} mutual {p.mutual === 1 ? "friend" : "friends"}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              onClick={() => addFriend(id)}
                              disabled={!id || addingFriendId === id}
                              className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm text-white shadow-sm hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60"
                            >
                              {addingFriendId === id ? "Adding…" : "Add friend"}
                            </button>
                            <button
                              onClick={() => startChat(id, name)}
                              disabled={!id || startingChatId === id || !canMessage}
                              className="rounded-xl bg-slate-100 px-4 py-2 text-sm text-slate-900 hover:bg-slate-200 disabled:opacity-60"
                            >
                              {startingChatId === id ? "Opening…" : canMessage ? "Message" : "Friends only"}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </main>

          {/* Right sidebar */}
          <aside className="lg:col-span-3">
            <div className="lg:sticky lg:top-4 space-y-4">
              <div className="rounded-2xl bg-white/80 ring-1 ring-slate-200/70 shadow-sm overflow-hidden backdrop-blur">
                <button
                  type="button"
                  onClick={() => setRequestsOpen((v) => !v)}
                  className="w-full px-4 py-3 border-b border-slate-200/70 flex items-center justify-between bg-gradient-to-r from-white to-slate-50"
                  aria-expanded={requestsOpen}
                >
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold text-gray-900">Friend requests</div>
                    <div className="text-xs text-gray-500">{requests.length}</div>
                  </div>
                  <span
                    className={[
                      "text-slate-500 transition-transform select-none",
                      requestsOpen ? "rotate-180" : "",
                    ].join(" ")}
                    aria-hidden
                  >
                    ▾
                  </span>
                </button>
                {requestsOpen && (
                  <>
                    {requests.length === 0 ? (
                      <div className="p-4 text-sm text-gray-600">No requests.</div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {requests.slice(0, 5).map((r) => {
                          const id = partnerId(r.from);
                          const name = displayName(r.from);
                          const key = id || cryptoRandomKey();
                          return (
                            <div
                              key={key}
                              className="p-3 flex items-center gap-3 hover:bg-white/60 transition"
                            >
                              {id ? <UserAvatar userId={id} name={name} size={36} /> : null}
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-semibold text-gray-900 truncate">
                                  {name}
                                </div>
                              </div>
                              <button
                                onClick={() => acceptFriend(id)}
                                disabled={!id || acceptingFriendId === id}
                                className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-1.5 text-xs text-white shadow-sm hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60"
                              >
                                {acceptingFriendId === id ? "Accepting…" : "Accept"}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="rounded-2xl bg-white/80 ring-1 ring-slate-200/70 shadow-sm overflow-hidden backdrop-blur">
                <button
                  type="button"
                  onClick={() => setFriendsOpen((v) => !v)}
                  className="w-full px-4 py-3 border-b border-slate-200/70 flex items-center justify-between bg-gradient-to-r from-white to-slate-50"
                  aria-expanded={friendsOpen}
                >
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold text-gray-900">Friends</div>
                    <div className="text-xs text-gray-500">{friends.length}</div>
                  </div>
                  <span
                    className={[
                      "text-slate-500 transition-transform select-none",
                      friendsOpen ? "rotate-180" : "",
                    ].join(" ")}
                    aria-hidden
                  >
                    ▾
                  </span>
                </button>
                {friendsOpen && (
                  <>
                    {friends.length === 0 ? (
                      <div className="p-4 text-sm text-gray-600">No friends yet.</div>
                    ) : (
                      <div className="divide-y divide-slate-100 max-h-[60vh] overflow-auto">
                        {friends.map((f) => {
                          const id = partnerId(f);
                          const name = displayName(f);
                          const key = id || cryptoRandomKey();
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => startChat(id, name)}
                              disabled={!id || startingChatId === id}
                              className="w-full p-3 flex items-center gap-3 hover:bg-white/60 transition disabled:opacity-60 text-left"
                              title={name}
                            >
                              {id ? <UserAvatar userId={id} name={name} size={36} /> : null}
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-semibold text-gray-900 truncate">
                                  {name}
                                </div>
                                <div className="text-xs text-gray-600">
                                  {startingChatId === id ? "Opening chat…" : "Tap to chat"}
                                </div>
                              </div>
                              <span className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs text-slate-900">
                                Chat
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

// Helpers
const initials = (name?: string) => {
  if (!name) return "??";
  const letters = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((n) => n.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return letters || "??";
};

// Fallback for keys if none provided (avoids unstable index keys)
const cryptoRandomKey = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
};

const formatDistance = (meters: number) => {
  if (!Number.isFinite(meters) || meters < 0) return null;
  if (meters < 1000) return `${Math.round(meters)} m away`;
  const km = meters / 1000;
  if (km < 10) return `${km.toFixed(1)} km away`;
  return `${Math.round(km)} km away`;
};
