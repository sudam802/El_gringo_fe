"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import UserAvatar from "@/components/UserAvatar";
import { authHeader } from "@/lib/authToken";
import { getBackendBaseUrl } from "@/lib/backendBaseUrl";
import { StreamChat } from "stream-chat";

type Friend = { id?: string; _id?: string; username?: string; email?: string };

function toIdString(id: unknown): string {
  return typeof id === "string" ? id : String(id ?? "");
}

function displayName(u: Friend): string {
  return u.username ?? u.email ?? "Friend";
}

type StreamTokenResponse = {
  apiKey: string;
  token: string;
  user: { id: string; name: string; image?: string };
  channelId: string | null;
};

type ChannelMemberLike = { user_id?: string; user?: { id?: string }; id?: string };
type ChannelStateLike = { members?: ChannelMemberLike[] | Record<string, ChannelMemberLike> };
type ChannelLike = { state?: ChannelStateLike; countUnread?: () => number };

function memberIdsFromChannel(channel: unknown): string[] {
  const members = (channel as ChannelLike | null | undefined)?.state?.members;
  if (!members) return [];

  const asId = (m: ChannelMemberLike | undefined) => String(m?.user_id ?? m?.user?.id ?? m?.id ?? "");

  if (Array.isArray(members)) return members.map(asId).filter(Boolean);
  if (typeof members === "object") return Object.values(members).map(asId).filter(Boolean);
  return [];
}

export default function Chat() {
  const router = useRouter();
  const base = getBackendBaseUrl();
  const fetchedRef = useRef(false);

  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [streamClient, setStreamClient] = useState<StreamChat | null>(null);
  const [unreadByFriend, setUnreadByFriend] = useState<Record<string, number>>({});

  const refresh = useCallback(async () => {
    if (!base) {
      setError("Missing NEXT_PUBLIC_BACKEND_URL");
      return;
    }

    setError(null);
    const res = await fetch(`${base}/api/friends`, {
      credentials: "include",
      headers: authHeader(),
    });

    if (res.status === 401) {
      router.push("/auth/login");
      return;
    }

    if (!res.ok) {
      const text = (await res.text()).trim();
      throw new Error(text || "Failed to load friends");
    }

    const data = (await res.json()) as { friends?: Friend[] };
    setFriends(Array.isArray(data?.friends) ? data.friends : []);
  }, [base, router]);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    const run = async () => {
      try {
        await refresh();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load friends");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [refresh]);

  useEffect(() => {
    if (!base) return;

    let client: StreamChat | null = null;
    let cancelled = false;

    const initStream = async () => {
      try {
        const res = await fetch(`${base}/api/stream/token`, {
          cache: "no-store",
          credentials: "include",
          headers: authHeader(),
        });

        if (res.status === 401) {
          router.push("/auth/login");
          return;
        }

        if (!res.ok) {
          setStreamClient(null);
          return;
        }

        const { apiKey, token, user } = (await res.json()) as StreamTokenResponse;
        if (!apiKey || !token || !user?.id) {
          setStreamClient(null);
          return;
        }

        client = StreamChat.getInstance(apiKey);
        await client.connectUser(
          { id: user.id, name: user.name, ...(user.image ? { image: user.image } : {}) },
          token
        );

        if (cancelled) return;
        setStreamClient(client);
      } catch {
        setStreamClient(null);
      }
    };

    initStream();

    return () => {
      cancelled = true;
      if (client) client.disconnectUser().catch(() => {});
    };
  }, [base, router]);

  const refreshUnreadCounts = useCallback(async () => {
    if (!streamClient?.userID) return;

    const friendIds = friends
      .map((f) => toIdString(f.id ?? f._id))
      .filter((id) => id && id !== streamClient.userID);

    if (friendIds.length === 0) {
      setUnreadByFriend({});
      return;
    }

    const channels = await streamClient.queryChannels(
      { type: "messaging", members: { $in: friendIds } },
      { last_message_at: -1 },
      { watch: false, state: true, presence: false, limit: 50 }
    );

    const next: Record<string, number> = Object.fromEntries(friendIds.map((id) => [id, 0]));

    for (const channel of channels) {
      const ids = memberIdsFromChannel(channel);
      const other = ids.find((id) => id && id !== streamClient.userID);
      if (!other || !(other in next)) continue;
      const maybe = channel as unknown as ChannelLike;
      const unread = typeof maybe.countUnread === "function" ? maybe.countUnread() : 0;
      next[other] = Math.max(next[other] ?? 0, Number(unread) || 0);
    }

    setUnreadByFriend(next);
  }, [friends, streamClient]);

  useEffect(() => {
    if (!streamClient) return;
    if (!streamClient.userID) return;
    if (friends.length === 0) return;

    refreshUnreadCounts().catch(() => {});
    const interval = setInterval(() => {
      refreshUnreadCounts().catch(() => {});
    }, 10000);

    return () => clearInterval(interval);
  }, [friends.length, refreshUnreadCounts, streamClient]);

  return (
    <div className="min-h-full">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Chat</h2>
            <p className="text-sm text-gray-600">Message accepted friends.</p>
          </div>
          <button
            type="button"
            onClick={() => refresh().catch(() => {})}
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-blue-700 ring-1 ring-blue-200 hover:bg-blue-50"
            disabled={loading}
          >
            Refresh
          </button>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <section className="mt-6 rounded-2xl bg-white/80 ring-1 ring-slate-200/70 shadow-sm overflow-hidden backdrop-blur">
          <div className="px-4 py-3 border-b border-slate-200/70 bg-gradient-to-r from-white to-slate-50">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-900">Friends</div>
              <div className="text-xs text-gray-500">{friends.length}</div>
            </div>
          </div>

          {loading ? (
            <div className="p-6 text-sm text-gray-600">Loading…</div>
          ) : friends.length === 0 ? (
            <div className="p-6 text-sm text-gray-600">
              No accepted friends yet. Add friends first, then you can chat.
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => router.push("/find-partner?stay=1")}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Find friends
                </button>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {friends.map((f) => {
                const id = toIdString(f.id ?? f._id);
                const name = displayName(f);
                const unread = id ? unreadByFriend[id] ?? 0 : 0;
                return (
                  <button
                    key={id || name}
                    type="button"
                    className="w-full p-4 flex items-center gap-3 text-left hover:bg-white/60 transition"
                    onClick={() =>
                      router.push(`/chat/${encodeURIComponent(id)}?name=${encodeURIComponent(name)}`)
                    }
                    disabled={!id}
                  >
                    {id ? <UserAvatar userId={id} name={name} size={40} /> : null}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-gray-900 truncate">{name}</div>
                      <div className="text-xs text-gray-600 truncate">Tap to open chat</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {unread > 0 ? (
                        <span
                          className="min-w-6 rounded-full bg-red-600 px-2 py-1 text-[11px] font-semibold text-white text-center"
                          aria-label={`${unread} unread message${unread === 1 ? "" : "s"}`}
                        >
                          {unread > 99 ? "99+" : unread}
                        </span>
                      ) : null}
                      <span className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs text-slate-900">
                        Open
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
