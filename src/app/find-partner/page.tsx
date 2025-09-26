"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

export default function FindPartner() {
  const router = useRouter();
  const [partners, setPartners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        console.log(res);

        if (res.status === 401) {
          router.push("/auth/login");
          return;
        }

        if (!res.ok) throw new Error(await res.text());

        const data = await res.json();
        setPartners(data.partners ?? data ?? []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load partners");
      } finally {
        setLoading(false);
      }
    };

    fetchPartners();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty - guarded by fetchedRef

  if (loading) return <div>Loading people you may want to play with…</div>;
  if (error) return <div className="text-red-600">Error: {error}</div>;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">People you may want to play with</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {partners.map((p) => (
          <div
            key={p._id ?? p.id ?? p.email}
            className="bg-white rounded-lg shadow-md ..."
          >
            <div className="p-4 flex items-center gap-4">
              <div className="flex-shrink-0">
                <div className="w-14 h-14 rounded-full bg-gray-200 flex items-center justify-center text-lg font-semibold text-gray-700">
                  {initials(p.name)}
                </div>
              </div>

              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">{p.name}</h3>
                    <p className="text-sm text-gray-500">🎯 {p.skill}</p>
                  </div>
                  <span className="text-xs text-gray-400">{p.location}</span>
                </div>

                <p className="text-sm text-gray-500 mt-2">
                  {p.mutual} mutual {p.mutual === 1 ? "friend" : "friends"}
                </p>

                <div className="mt-4 flex gap-2">
                  <button
                    className="flex-1 py-2 px-3 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700 transition"
                    aria-label={`Add ${p.name}`}
                  >
                    Add Friend
                  </button>
                  <button
                    className="flex-1 py-2 px-3 rounded-md bg-gray-200 text-gray-700 text-sm hover:bg-gray-300 transition"
                    aria-label={`Message ${p.name}`}
                  >
                    Message
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

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
