"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import UserAvatar from "@/components/UserAvatar";
import { authHeader } from "@/lib/authToken";
import { getBackendBaseUrl } from "@/lib/backendBaseUrl";

type FeedMedia = { type: "image" | "video"; url: string };
type FeedPost = {
  id: string;
  text: string;
  media: FeedMedia | null;
  createdAt: string;
  author: { id: string; username?: string; fullName?: string; email?: string };
};

type EventItem = {
  id: string;
  title: string;
  sport?: string;
  startsAt: string;
  maxParticipants: number;
  participantsCount: number;
  joined: boolean;
};

type Friend = { id?: string; _id?: string; username?: string; email?: string };

function toIdString(id: unknown): string {
  return typeof id === "string" ? id : String(id ?? "");
}

function displayName(user: { username?: string; fullName?: string; email?: string } | null): string {
  return user?.username ?? user?.fullName ?? user?.email ?? "Unknown";
}

function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  const t = d.getTime();
  if (Number.isNaN(t)) return "";
  const diffSec = Math.round((Date.now() - t) / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr ago`;
  return `${Math.round(diffHr / 24)}d ago`;
}

function resolveMediaUrl(base: string | undefined, url: string): string {
  const raw = String(url ?? "").trim();
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  if (raw.startsWith("/") && base) return `${base}${raw}`;
  return raw;
}

function Card({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="app-card overflow-hidden">
      <div className="app-card-header flex items-center justify-between">
        <div className="text-lg font-semibold text-slate-900">{title}</div>
        {right ? <div className="text-sm text-slate-600">{right}</div> : null}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function FeedCard({
  base,
  post,
  onConnect,
  connectBusy,
}: {
  base: string | undefined;
  post: FeedPost;
  onConnect: (userId: string) => void;
  connectBusy: boolean;
}) {
  const authorId = toIdString(post.author?.id);
  const name = displayName(post.author ?? null);
  const handle = post.author?.username ? `@${post.author.username}` : null;
  const mediaUrl = post.media ? resolveMediaUrl(base, post.media.url) : "";

  return (
    <article className="app-card overflow-hidden">
      <div className="p-5 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {authorId ? <UserAvatar userId={authorId} name={name} size={46} /> : null}
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="font-semibold text-slate-900 truncate">{name}</div>
              {handle ? <div className="text-sm text-slate-500 truncate">{handle}</div> : null}
            </div>
            <div className="text-sm text-slate-500">{formatRelativeTime(post.createdAt)}</div>
          </div>
        </div>

        <button type="button" className="text-slate-400 hover:text-slate-600" aria-label="More">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-hidden="true">
            <circle cx="5" cy="12" r="1.8" />
            <circle cx="12" cy="12" r="1.8" />
            <circle cx="19" cy="12" r="1.8" />
          </svg>
        </button>
      </div>

      <div className="px-5 pb-4 text-xl text-slate-800 leading-snug">{post.text}</div>

      {mediaUrl ? (
        <div className="px-5 pb-5">
          <div className="relative w-full overflow-hidden rounded-2xl bg-slate-100 aspect-[16/9]">
            {post.media?.type === "video" ? (
              <video src={mediaUrl} controls className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <img
                src={mediaUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                loading="lazy"
              />
            )}
          </div>
        </div>
      ) : null}

      <div className="px-5 pb-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-5 text-slate-500">
          <span className="inline-flex items-center gap-2">
            <span className="text-lg tabular-nums">0</span>
            <span className="text-sm">likes</span>
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="text-lg tabular-nums">0</span>
            <span className="text-sm">comments</span>
          </span>
        </div>

        <button
          type="button"
          onClick={() => onConnect(authorId)}
          disabled={!authorId || connectBusy}
          className="btn-primary px-6 py-3 text-sm"
        >
          {connectBusy ? "Connecting…" : "Connect"}
        </button>
      </div>
    </article>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const base = useMemo(() => getBackendBaseUrl(), []);

  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectingTo, setConnectingTo] = useState<string | null>(null);
  const joiningRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (!base) {
      setError("Missing NEXT_PUBLIC_BACKEND_URL");
      setLoading(false);
      return;
    }

    setError(null);
    const headers = authHeader();
    const [feedRes, eventsRes, friendsRes] = await Promise.all([
      fetch(`${base}/api/feed`, { credentials: "include", headers }),
      fetch(`${base}/api/events`, { credentials: "include", headers }),
      fetch(`${base}/api/friends`, { credentials: "include", headers }),
    ]);

    if (feedRes.status === 401 || eventsRes.status === 401 || friendsRes.status === 401) {
      router.replace("/auth/login");
      return;
    }

    if (feedRes.ok) {
      const data = (await feedRes.json()) as { posts?: FeedPost[] };
      setPosts(Array.isArray(data?.posts) ? data.posts.slice(0, 6) : []);
    } else {
      setPosts([]);
    }

    if (eventsRes.ok) {
      const data = (await eventsRes.json()) as { events?: EventItem[] };
      setEvents(Array.isArray(data?.events) ? data.events : []);
    } else {
      setEvents([]);
    }

    if (friendsRes.ok) {
      const data = (await friendsRes.json()) as { friends?: Friend[] };
      setFriends(Array.isArray(data?.friends) ? data.friends : []);
    } else {
      setFriends([]);
    }
  }, [base, router]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await refresh();
      } catch {
        if (!mounted) return;
        setError("Failed to load dashboard");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [refresh]);

  const featuredEvent = useMemo(() => {
    if (events.length === 0) return null;
    const sorted = [...events].sort((a, b) => {
      const ta = new Date(a.startsAt).getTime();
      const tb = new Date(b.startsAt).getTime();
      if (Number.isNaN(ta) && Number.isNaN(tb)) return 0;
      if (Number.isNaN(ta)) return 1;
      if (Number.isNaN(tb)) return -1;
      return ta - tb;
    });
    return sorted[0] ?? null;
  }, [events]);

  const joinFeatured = useCallback(async () => {
    if (!base || !featuredEvent) return;
    if (joiningRef.current) return;
    joiningRef.current = featuredEvent.id;
    setError(null);
    try {
      const action = featuredEvent.joined ? "leave" : "join";
      const res = await fetch(
        `${base}/api/events/${encodeURIComponent(featuredEvent.id)}/${action}`,
        { method: "POST", credentials: "include", headers: authHeader() }
      );
      if (res.status === 401) {
        router.replace("/auth/login");
        return;
      }
      if (!res.ok) throw new Error("Event action failed");
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Event action failed");
    } finally {
      joiningRef.current = null;
    }
  }, [base, featuredEvent, refresh, router]);

  const connectToAuthor = useCallback(
    async (targetUserId: string) => {
      if (!base) return;
      if (!targetUserId) return;
      setConnectingTo(targetUserId);
      setError(null);
      try {
        const res = await fetch(`${base}/api/friends/request`, {
          method: "POST",
          headers: { ...authHeader(), "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ userId: targetUserId }),
        });
        if (res.status === 401) {
          router.replace("/auth/login");
          return;
        }
        if (!res.ok) throw new Error("Failed to send request");
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to send request");
      } finally {
        setConnectingTo(null);
      }
    },
    [base, router]
  );

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center text-slate-500">
        Loading…
      </main>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="app-container py-10">
        {error ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <section className="lg:col-span-8">
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="text-4xl font-bold tracking-tight text-slate-900">Feeds</div>
                <div className="mt-2 text-slate-600">See what friends are up to and connect.</div>
              </div>
              <button
                type="button"
                onClick={() => router.push("/feed")}
                className="btn-secondary px-4 py-2 text-sm"
              >
                Open feed
              </button>
            </div>

            <div className="mt-8 space-y-8">
              {posts.length === 0 ? (
                <div className="app-card p-10 text-slate-700">No posts yet.</div>
              ) : (
                posts.map((p) => (
                  <FeedCard
                    key={p.id}
                    base={base}
                    post={p}
                    onConnect={connectToAuthor}
                    connectBusy={connectingTo === toIdString(p.author?.id)}
                  />
                ))
              )}
            </div>
          </section>

          <aside className="lg:col-span-4 space-y-8">
            <Card
              title="Events"
              right={
                <button
                  type="button"
                  className="text-slate-500 hover:text-slate-700"
                  onClick={() => router.push("/events")}
                >
                  View all
                </button>
              }
            >
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-sky-600 via-blue-600 to-indigo-700 text-white">
                <div className="absolute inset-0 opacity-25">
                  <Image src="/hero-sport.png" alt="" fill className="object-cover" sizes="400px" />
                </div>
                <div className="relative p-5">
                  <div className="text-lg font-semibold">Upcoming Sports Meetup</div>
                  <div className="mt-2 text-white/90">
                    {featuredEvent ? (
                      <div className="space-y-1">
                        <div className="text-2xl font-bold leading-tight">{featuredEvent.title}</div>
                        <div className="text-sm text-white/85">
                          {new Date(featuredEvent.startsAt).toLocaleString()}
                          {featuredEvent.sport ? ` • ${featuredEvent.sport}` : ""}
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-white/85">Create an event and invite players.</div>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div className="text-sm text-white/85">
                      {featuredEvent
                        ? `${Math.max(0, featuredEvent.maxParticipants - featuredEvent.participantsCount)} spots left`
                        : "No upcoming events"}
                    </div>

                    <button
                      type="button"
                      onClick={featuredEvent ? joinFeatured : () => router.push("/events")}
                      disabled={!!joiningRef.current}
                      className="rounded-2xl bg-white/20 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/30 hover:bg-white/25 disabled:opacity-60"
                    >
                      {featuredEvent ? (featuredEvent.joined ? "Leave" : "Join Now") : "Create"}
                    </button>
                  </div>
                </div>
              </div>
            </Card>

            <Card
              title="Friends"
              right={
                <button
                  type="button"
                  className="text-slate-500 hover:text-slate-700"
                  onClick={() => router.push("/chat")}
                >
                  View all
                </button>
              }
            >
              {friends.length === 0 ? (
                <div className="text-sm text-slate-600">
                  No friends yet.
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => router.push("/find-partner?stay=1")}
                      className="btn-secondary px-4 py-2 text-sm"
                    >
                      Find partners
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {friends.slice(0, 4).map((f) => {
                    const id = toIdString(f.id ?? f._id);
                    const name = displayName(f as { username?: string; email?: string });
                    return (
                      <div key={id || name} className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          {id ? <UserAvatar userId={id} name={name} size={40} /> : null}
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 truncate">{name}</div>
                            <div className="text-sm text-slate-500">Online</div>
                          </div>
                        </div>
                        <span
                          className="inline-flex h-3 w-3 rounded-full bg-emerald-500 ring-4 ring-emerald-100"
                          aria-label="Online"
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            <Card title="Chat">
              <div className="flex items-center justify-between gap-4">
                <div className="text-sm text-slate-600">Jump into your conversations.</div>
                <button
                  type="button"
                  onClick={() => router.push("/chat")}
                  className="btn-primary px-5 py-3 text-sm"
                >
                  Open Chat
                </button>
              </div>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  );
}
