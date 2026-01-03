"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import UserAvatar from "@/components/UserAvatar";

type Partner = {
  _id?: string;
  id?: string;
  email?: string;
  username?: string;
  skill?: string;
  location?: string;
  mutual?: number;
};

export default function FindPartner() {
  const router = useRouter();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startingChatId, setStartingChatId] = useState<string | null>(null);

  // Prevent double fetch (React Strict Mode mounts component twice in dev)
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    const fetchPartners = async () => {
      try {
        const url = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/partners/find-partner`;
        console.debug("FindPartner: fetching", url);
        const res = await fetch(url, { credentials: "include" });

        if (res.status === 401) {
          router.push("/auth/login");
          return;
        }

        if (!res.ok) throw new Error(await res.text());

        const data = await res.json();
        console.debug("FindPartner: fetched partners", data);
        setPartners((data?.partners ?? data ?? []) as Partner[]);
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

  if (loading) return <div>Loading people you may want to play with…</div>;
  if (error) return <div className="text-red-600">Error: {error}</div>;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">People you may want to play with</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {partners.map((p) => {
          const key = p._id ?? p.id ?? p.email ?? cryptoRandomKey();
          const displayName = p.username ?? p.email ?? "Unknown";
          const partnerId = String(p._id ?? p.id ?? "");

          return (
            <div key={key} className="bg-white rounded-lg shadow-md ...">
              <div className="p-4 flex items-center gap-4">
                <div className="flex-shrink-0">
                  {partnerId ? (
                    <UserAvatar userId={partnerId} name={displayName} size={56} />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-gray-200 flex items-center justify-center text-lg font-semibold text-gray-700">
                      {initials(displayName)}
                    </div>
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">{displayName}</h3>
                      {p.skill && (
                        <p className="text-sm text-gray-500">🎯 {p.skill}</p>
                      )}
                    </div>
                    {p.location && (
                      <span className="text-xs text-gray-400">{p.location}</span>
                    )}
                  </div>

                  {typeof p.mutual === "number" && (
                    <p className="text-sm text-gray-500 mt-2">
                      {p.mutual} mutual {p.mutual === 1 ? "friend" : "friends"}
                    </p>
                  )}

                  <div className="mt-4 flex gap-2">
                    <button
                      className="flex-1 py-2 px-3 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700 transition"
                      aria-label={`Add ${displayName}`}
                    >
                      Add Friend
                    </button>
                    <button
                      onClick={() => startChat(partnerId, displayName)}
                      disabled={startingChatId === partnerId}
                      className="flex-1 py-2 px-3 rounded-md bg-gray-200 text-gray-700 text-sm hover:bg-gray-300 transition disabled:opacity-60"
                      aria-label={`Message ${displayName}`}
                    >
                      {startingChatId === partnerId ? "Opening…" : "Message"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
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
