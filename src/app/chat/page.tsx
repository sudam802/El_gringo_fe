"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import UserAvatar from "@/components/UserAvatar";
import { authHeader } from "@/lib/authToken";

type Friend = { id?: string; _id?: string; username?: string; email?: string };

function toIdString(id: unknown): string {
  return typeof id === "string" ? id : String(id ?? "");
}

function displayName(u: Friend): string {
  return u.username ?? u.email ?? "Friend";
}

export default function Chat() {
  const router = useRouter();
  const base = String(process.env.NEXT_PUBLIC_BACKEND_URL || "").trim().replace(/\/+$/, "");
  const fetchedRef = useRef(false);

  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Chat</h2>
            <p className="text-sm text-gray-600">Message accepted friends.</p>
          </div>
          <button
            type="button"
            onClick={() => refresh().catch(() => {})}
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-50"
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
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
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
                    <span className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs text-slate-900">
                      Open
                    </span>
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
