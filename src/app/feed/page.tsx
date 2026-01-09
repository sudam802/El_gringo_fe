"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import UserAvatar from "@/components/UserAvatar";
import { authHeader } from "@/lib/authToken";

type FeedMedia = { type: "image" | "video"; url: string };
type FeedPost = {
  id: string;
  text: string;
  media: FeedMedia | null;
  visibility: "friends" | "public";
  createdAt: string;
  author: { id: string; username?: string; fullName?: string };
};

type SuggestionUser = {
  id: string;
  username?: string;
  fullName?: string;
  location?: string;
  preferredSports?: string[];
  skillLevel?: string;
};

type FriendRequest = {
  from: { id?: string; _id?: string; username?: string; fullName?: string; email?: string };
  createdAt: string;
};

function toIdString(id: unknown): string {
  return typeof id === "string" ? id : String(id ?? "");
}

function displayName(user: { username?: string; fullName?: string; email?: string } | null): string {
  return user?.username ?? user?.fullName ?? user?.email ?? "Unknown";
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

function resolveMediaUrl(base: string | undefined, url: string): string {
  const raw = String(url ?? "").trim();
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  if (raw.startsWith("/") && base) return `${base}${raw}`;
  return raw;
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

export default function FeedPage() {
  const router = useRouter();
  const base = String(process.env.NEXT_PUBLIC_BACKEND_URL || "").trim().replace(/\/+$/, "");

  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestionUser[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [text, setText] = useState("");
  const [visibility, setVisibility] = useState<FeedPost["visibility"]>("friends");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string | null>(null);
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState<FeedMedia["type"]>("image");
  const [posting, setPosting] = useState(false);
  const [addingFriendId, setAddingFriendId] = useState<string | null>(null);
  const [acceptingFriendId, setAcceptingFriendId] = useState<string | null>(null);

  const fetchedRef = useRef(false);
  const mediaInputRef = useRef<HTMLInputElement | null>(null);

  const refresh = useCallback(async () => {
    if (!base) {
      setError("Missing NEXT_PUBLIC_BACKEND_URL");
      setLoading(false);
      return;
    }

    setError(null);
    const headers = authHeader();
    const [feedRes, suggestionsRes, requestsRes] = await Promise.all([
      fetch(`${base}/api/feed`, { credentials: "include", headers }),
      fetch(`${base}/api/friends/suggestions?limit=6`, { credentials: "include", headers }),
      fetch(`${base}/api/friends/requests`, { credentials: "include", headers }),
    ]);

    if (feedRes.status === 401 || suggestionsRes.status === 401 || requestsRes.status === 401) {
      router.push("/auth/login");
      return;
    }

    if (feedRes.ok) {
      const parsed = await readJsonOrText(feedRes);
      if (parsed.isJson) {
        const data = parsed.body as { posts?: FeedPost[] };
        setPosts(Array.isArray(data?.posts) ? data.posts : []);
      }
    } else {
      const parsed = await readJsonOrText(feedRes);
      setError(messageFromBody(parsed) ?? "Failed to load feed");
    }

    if (suggestionsRes.ok) {
      const parsed = await readJsonOrText(suggestionsRes);
      if (parsed.isJson) {
        const data = parsed.body as { suggestions?: SuggestionUser[] };
        setSuggestions(Array.isArray(data?.suggestions) ? data.suggestions : []);
      }
    }

    if (requestsRes.ok) {
      const parsed = await readJsonOrText(requestsRes);
      if (parsed.isJson) {
        const data = parsed.body as { requests?: FriendRequest[] };
        setRequests(Array.isArray(data?.requests) ? data.requests : []);
      }
    }
  }, [base, router]);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    const run = async () => {
      try {
        await refresh();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load feed");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [refresh]);

  useEffect(() => {
    if (!mediaFile) {
      setMediaPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(mediaFile);
    setMediaPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [mediaFile]);

  const canPost = useMemo(() => {
    return Boolean(text.trim() || mediaFile || mediaUrl.trim());
  }, [mediaFile, mediaUrl, text]);

  const submitPost = useCallback(async () => {
    if (!base) return;
    if (!canPost) return;

    setPosting(true);
    setError(null);
    try {
      const res = mediaFile
        ? await fetch(`${base}/api/feed`, {
            method: "POST",
            credentials: "include",
            headers: authHeader(),
            body: (() => {
              const fd = new FormData();
              if (text.trim()) fd.append("text", text.trim());
              fd.append("visibility", visibility);
              fd.append("media", mediaFile);
              return fd;
            })(),
          })
        : await fetch(`${base}/api/feed`, {
            method: "POST",
            headers: { ...authHeader(), "content-type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              text: text.trim(),
              visibility,
              mediaUrl: mediaUrl.trim() || undefined,
              mediaType: mediaUrl.trim() ? mediaType : undefined,
            }),
          });

      if (res.status === 401) {
        router.push("/auth/login");
        return;
      }

      if (!res.ok) {
        const parsed = await readJsonOrText(res);
        throw new Error(messageFromBody(parsed) ?? "Failed to create post");
      }

      setText("");
      setVisibility("friends");
      setMediaFile(null);
      if (mediaInputRef.current) mediaInputRef.current.value = "";
      setMediaUrl("");
      setMediaType("image");
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create post");
    } finally {
      setPosting(false);
    }
  }, [base, canPost, mediaFile, mediaType, mediaUrl, refresh, router, text, visibility]);

  const addFriend = useCallback(
    async (targetUserId: string) => {
      if (!base) return;
      if (!targetUserId) return;
      setAddingFriendId(targetUserId);
      setError(null);
      try {
        const res = await fetch(`${base}/api/friends/request`, {
          method: "POST",
          headers: { ...authHeader(), "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ userId: targetUserId }),
        });

        if (res.status === 401) {
          router.push("/auth/login");
          return;
        }

        if (!res.ok) {
          const parsed = await readJsonOrText(res);
          throw new Error(messageFromBody(parsed) ?? "Failed to send request");
        }

        setSuggestions((prev) => prev.filter((u) => toIdString(u.id) !== targetUserId));
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to send request");
      } finally {
        setAddingFriendId(null);
      }
    },
    [base, router]
  );

  const acceptFriend = useCallback(
    async (fromUserId: string) => {
      if (!base) return;
      if (!fromUserId) return;
      setAcceptingFriendId(fromUserId);
      setError(null);
      try {
        const res = await fetch(`${base}/api/friends/accept`, {
          method: "POST",
          headers: { ...authHeader(), "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ userId: fromUserId }),
        });

        if (res.status === 401) {
          router.push("/auth/login");
          return;
        }

        if (!res.ok) {
          const parsed = await readJsonOrText(res);
          throw new Error(messageFromBody(parsed) ?? "Failed to accept request");
        }

        await refresh();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to accept request");
      } finally {
        setAcceptingFriendId(null);
      }
    },
    [base, refresh, router]
  );

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center text-gray-500">
        Loading…
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Your Feed</h2>
            <p className="text-sm text-gray-600">
              Share a quick update, photo, or training clip.
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push("/find-partner?stay=1")}
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-50"
          >
            Find Partner
          </button>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <main className="lg:col-span-2 space-y-4">
            <section className="rounded-2xl bg-white/80 ring-1 ring-slate-200/70 shadow-sm overflow-hidden backdrop-blur">
              <div className="px-4 py-3 border-b border-slate-200/70 bg-gradient-to-r from-white to-slate-50">
                <div className="text-sm font-semibold text-gray-900">Create a post</div>
              </div>
              <div className="p-4 space-y-3">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="What are you working on today?"
                  className="w-full min-h-24 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-200 focus:ring bg-white"
                />

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
                  <select
                    value={visibility}
                    onChange={(e) => setVisibility(e.target.value as FeedPost["visibility"])}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white sm:col-span-2"
                  >
                    <option value="friends">Friends</option>
                    <option value="public">Public</option>
                  </select>

                  <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-white p-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">Upload from computer</div>
                        <div className="text-xs text-slate-600">Images/videos up to 150MB.</div>
                      </div>
                      <input
                        type="file"
                        accept="image/*,video/*"
                        ref={mediaInputRef}
                        onChange={(e) => {
                          const f = e.target.files?.[0] ?? null;
                          setMediaFile(f);
                          if (f) setMediaUrl("");
                        }}
                        className="block w-full sm:w-auto text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-600 file:px-3 file:py-2 file:text-white hover:file:bg-emerald-700"
                      />
                    </div>

                    {mediaFile ? (
                      <div className="mt-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm text-slate-800 truncate">{mediaFile.name}</div>
                            <div className="text-xs text-slate-500">
                              {(mediaFile.size / (1024 * 1024)).toFixed(2)} MB
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setMediaFile(null);
                              if (mediaInputRef.current) mediaInputRef.current.value = "";
                            }}
                            className="rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                          >
                            Remove
                          </button>
                        </div>

                        {mediaPreviewUrl ? (
                          <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
                            {mediaFile.type.startsWith("video/") ? (
                              <video
                                controls
                                src={mediaPreviewUrl}
                                className="w-full max-h-[420px] object-contain bg-black"
                              />
                            ) : (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={mediaPreviewUrl}
                                alt="Upload preview"
                                className="w-full max-h-[420px] object-contain bg-slate-50"
                              />
                            )}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <input
                    value={mediaUrl}
                    onChange={(e) => setMediaUrl(e.target.value)}
                    placeholder="Optional media URL (image or video)"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-200 focus:ring bg-white"
                    disabled={Boolean(mediaFile)}
                  />
                  <select
                    value={mediaType}
                    onChange={(e) => setMediaType(e.target.value as FeedMedia["type"])}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
                    disabled={Boolean(mediaFile) || !mediaUrl.trim()}
                  >
                    <option value="image">Image</option>
                    <option value="video">Video</option>
                  </select>
                </div>

                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setText("");
                      setVisibility("friends");
                      setMediaFile(null);
                      if (mediaInputRef.current) mediaInputRef.current.value = "";
                      setMediaUrl("");
                      setMediaType("image");
                    }}
                    className="rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                    disabled={posting}
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={submitPost}
                    disabled={!canPost || posting}
                    className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:from-emerald-700 hover:to-teal-700 disabled:opacity-60"
                  >
                    {posting ? "Posting…" : "Post"}
                  </button>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              {posts.length === 0 ? (
                <div className="rounded-2xl bg-white/80 ring-1 ring-slate-200/70 shadow-sm p-6 text-sm text-gray-600 backdrop-blur">
                  No posts yet. Create your first post above.
                </div>
              ) : (
                posts.map((p) => {
                  const name = p.author?.username ?? p.author?.fullName ?? "Member";
                  const mediaSrc = p.media?.url ? resolveMediaUrl(base, p.media.url) : "";
                  return (
                    <article
                      key={p.id}
                      className="rounded-2xl bg-white/80 ring-1 ring-slate-200/70 shadow-sm overflow-hidden backdrop-blur"
                    >
                      <div className="p-4 flex items-start gap-3">
                        {p.author?.id ? (
                          <UserAvatar userId={p.author.id} name={name} size={40} />
                        ) : (
                          <span className="inline-block w-10 h-10 rounded-full bg-slate-200" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="truncate">
                              <span className="text-sm font-semibold text-gray-900">{name}</span>
                              <span className="ml-2 text-xs text-gray-500">
                                {formatTime(p.createdAt)}
                              </span>
                            </div>
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">
                              {p.visibility}
                            </span>
                          </div>
                          {p.text ? (
                            <div className="mt-2 text-sm text-gray-800 whitespace-pre-wrap">
                              {p.text}
                            </div>
                          ) : null}
                        </div>
                      </div>

                      {mediaSrc ? (
                        <div className="border-t border-slate-200/70 bg-white">
                          {p.media && p.media.type === "video" ? (

                            <video
                              controls
                              src={mediaSrc}
                              className="w-full max-h-[520px] object-contain bg-black"
                            />
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={mediaSrc}
                              alt="Post media"
                              className="w-full max-h-[520px] object-contain bg-slate-50"
                              loading="lazy"
                            />
                          )}
                        </div>
                      ) : null}
                    </article>
                  );
                })
              )}
            </section>
          </main>

          <aside className="space-y-4">
            <section className="rounded-2xl bg-white/80 ring-1 ring-slate-200/70 shadow-sm overflow-hidden backdrop-blur">
              <div className="px-4 py-3 border-b border-slate-200/70 bg-gradient-to-r from-white to-slate-50">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-gray-900">People you may know</div>
                  <button
                    type="button"
                    onClick={() => refresh().catch(() => {})}
                    className="text-xs text-emerald-700 hover:underline"
                  >
                    Refresh
                  </button>
                </div>
              </div>
              <div className="p-4 space-y-3">
                {suggestions.length === 0 ? (
                  <div className="text-sm text-gray-600">No suggestions right now.</div>
                ) : (
                  suggestions.map((u) => {
                    const id = toIdString(u.id);
                    const name = u.username ?? u.fullName ?? "Member";
                    return (
                      <div key={id} className="flex items-center gap-3">
                        <UserAvatar userId={id} name={name} size={36} />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-gray-900 truncate">{name}</div>
                          <div className="text-xs text-gray-600 truncate">
                            {(u.skillLevel ? `${u.skillLevel} • ` : "") + (u.location ?? "")}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => addFriend(id)}
                          disabled={!id || addingFriendId === id}
                          className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs text-white hover:bg-emerald-700 disabled:opacity-60"
                        >
                          {addingFriendId === id ? "Adding…" : "Add"}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            <section className="rounded-2xl bg-white/80 ring-1 ring-slate-200/70 shadow-sm overflow-hidden backdrop-blur">
              <div className="px-4 py-3 border-b border-slate-200/70 bg-gradient-to-r from-white to-slate-50">
                <div className="text-sm font-semibold text-gray-900">Friend requests</div>
              </div>
              <div className="p-4 space-y-3">
                {requests.length === 0 ? (
                  <div className="text-sm text-gray-600">No pending requests.</div>
                ) : (
                  requests.map((r) => {
                    const id = toIdString(r.from?.id ?? r.from?._id);
                    const name = displayName(r.from ?? null);
                    return (
                      <div key={`${id}-${r.createdAt}`} className="flex items-center gap-3">
                        {id ? <UserAvatar userId={id} name={name} size={36} /> : null}
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-gray-900 truncate">{name}</div>
                          <div className="text-xs text-gray-600">{formatTime(r.createdAt)}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => acceptFriend(id)}
                          disabled={!id || acceptingFriendId === id}
                          className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-3 py-1.5 text-xs text-white shadow-sm hover:from-emerald-700 hover:to-teal-700 disabled:opacity-60"
                        >
                          {acceptingFriendId === id ? "Accepting…" : "Accept"}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            <section className="rounded-2xl bg-white/80 ring-1 ring-slate-200/70 shadow-sm p-4 backdrop-blur">
              <div className="text-sm font-semibold text-gray-900">Quick actions</div>
              <div className="mt-3 grid gap-2">
                <button
                  type="button"
                  onClick={() => router.push("/events")}
                  className="w-full rounded-xl bg-slate-100 px-4 py-2 text-sm text-slate-900 hover:bg-slate-200 text-left"
                >
                  Browse events
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/profile")}
                  className="w-full rounded-xl bg-slate-100 px-4 py-2 text-sm text-slate-900 hover:bg-slate-200 text-left"
                >
                  Edit profile
                </button>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
