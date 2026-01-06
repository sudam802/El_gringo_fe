"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

interface AuthFormProps {
  mode: "login" | "signup";
}

const SPORTS_OPTIONS = [
  "Badminton",
  "Tennis",
  "Football",
  "Basketball",
  "Volleyball",
  "Cricket",
  "Table Tennis",
  "Running",
  "Swimming",
  "Gym",
] as const;

const SKILL_LEVEL_OPTIONS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
  { value: "pro", label: "Pro" },
] as const;

type SkillLevel = (typeof SKILL_LEVEL_OPTIONS)[number]["value"];

type GeoCoords = { lat: number; lng: number };
type GeoResult = { displayName: string; lat: number; lng: number };

export default function AuthForm({ mode }: AuthFormProps) {
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [location, setLocation] = useState("");
  const [locationCoords, setLocationCoords] = useState<GeoCoords | null>(null);
  const [geoResults, setGeoResults] = useState<GeoResult[]>([]);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoOpen, setGeoOpen] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [geoLocating, setGeoLocating] = useState(false);
  const [preferredSports, setPreferredSports] = useState<string[]>([]);
  const [skillLevel, setSkillLevel] = useState<SkillLevel | "">("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );
  const [submitting, setSubmitting] = useState(false);

  const router = useRouter();

  const avatarPreviewUrl = useMemo(() => {
    if (!avatarFile) return null;
    return URL.createObjectURL(avatarFile);
  }, [avatarFile]);

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
    };
  }, [avatarPreviewUrl]);

  const toggleSport = (sport: string) => {
    setPreferredSports((prev) => {
      if (prev.includes(sport)) return prev.filter((s) => s !== sport);
      return [...prev, sport];
    });
  };

  useEffect(() => {
    if (mode !== "signup") return;
    if (!geoOpen) return;
    const q = location.trim();
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
  }, [location, geoOpen, mode]);

  const selectGeo = (item: GeoResult) => {
    setLocation(item.displayName);
    setLocationCoords({ lat: item.lat, lng: item.lng });
    setGeoOpen(false);
    setGeoResults([]);
  };

  const useMyLocation = async () => {
    if (mode !== "signup") return;
    if (!navigator.geolocation) {
      setMessage({ type: "error", text: "Geolocation is not supported in this browser" });
      return;
    }

    setGeoLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setLocationCoords({ lat, lng });

        try {
          const res = await fetch(`/api/geo/reverse?lat=${lat}&lng=${lng}`);
          const data = (await res.json()) as { displayName?: string | null };
          if (res.ok && data.displayName) {
            setLocation(data.displayName);
          } else if (!location.trim()) {
            setLocation("Current location");
          }
        } catch {
          if (!location.trim()) setLocation("Current location");
        } finally {
          setGeoLocating(false);
        }
      },
      () => {
        setGeoLocating(false);
        setMessage({ type: "error", text: "Could not get your current location" });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const uploadAvatarIfNeeded = async () => {
    if (!avatarFile) return;
    const formData = new FormData();
    formData.set("file", avatarFile);

    const res = await fetch("/api/avatar", { method: "POST", body: formData });
    const data = (await res.json()) as { message?: string; avatarUrl?: string };
    if (!res.ok) {
      throw new Error(data.message || "Avatar upload failed");
    }

    const v = Date.now();
    try {
      localStorage.setItem("avatar", String(v));
    } catch {}
    try {
      window.dispatchEvent(new Event("avatar"));
    } catch {}
    void data;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (submitting) return;

    const url = mode === "login" ? "/api/auth/login" : "/api/auth/register";

    try {
      if (mode === "signup") {
        if (!fullName.trim()) {
          setMessage({ type: "error", text: "Please enter your full name" });
          return;
        }
        if (!username.trim()) {
          setMessage({ type: "error", text: "Please enter a username" });
          return;
        }
        if (!location.trim()) {
          setMessage({ type: "error", text: "Please enter your location" });
          return;
        }
        if (preferredSports.length === 0) {
          setMessage({ type: "error", text: "Please select at least one preferred sport" });
          return;
        }
        if (!skillLevel) {
          setMessage({ type: "error", text: "Please select your skill level" });
          return;
        }
      }

      setSubmitting(true);
      const body =
        mode === "login"
          ? { email, password }
          : {
              fullName,
              username,
              email,
              password,
              location,
              locationCoords,
              preferredSports,
              skillLevel,
            };

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}${url}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          credentials: "include",
        }
      );

      if (res.ok) {
        const data = await res.json();
        const successText = (data?.message as string | undefined) || "Success";
        setMessage({ type: "success", text: successText });

        if (mode === "signup") {
          try {
            await uploadAvatarIfNeeded();
          } catch (err: unknown) {
            const text =
              err instanceof Error
                ? err.message
                : "Registered, but profile picture upload failed";
            setMessage({ type: "error", text });
          }
        }

        // Notify the Navbar (and other tabs) that auth changed:
        try {
          localStorage.setItem("auth", Date.now().toString());
        } catch {}
        try {
          window.dispatchEvent(new Event("auth"));
        } catch {}


        // redirect
        router.push("/feed");
      } else {
        const data = await res.json();
        throw new Error(data.message || "Error");
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setMessage({ type: "error", text: err.message });
      } else {
        setMessage({ type: "error", text: "An unexpected error occurred" });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-xl">
      <div className="rounded-2xl border bg-white shadow-sm">
        <div className="px-6 pt-6">
          <h2 className="text-2xl font-bold text-gray-900">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            {mode === "login"
              ? "Login to find your next sports partner."
              : "Tell us a bit about you so we can match you better."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="px-6 pb-6 pt-5">
          {mode === "signup" && (
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-[140px_1fr] sm:items-start">
              <div className="flex items-center gap-4 sm:block">
                <div className="relative">
                  <div className="h-20 w-20 overflow-hidden rounded-full border bg-gray-50">
                    {avatarPreviewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={avatarPreviewUrl}
                        alt="Profile preview"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-gray-500">
                        PHOTO
                      </div>
                    )}
                  </div>
                </div>

                <div className="sm:mt-3">
                  <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
                    />
                    {avatarFile ? "Change photo" : "Add photo"}
                  </label>
                  {avatarFile && (
                    <button
                      type="button"
                      onClick={() => setAvatarFile(null)}
                      className="ml-3 text-sm text-gray-600 hover:underline"
                    >
                      Remove
                    </button>
                  )}
                  <div className="mt-1 text-xs text-gray-500">Optional (max 5MB)</div>
                </div>
              </div>

                <div className="grid gap-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium text-gray-800">Full name</label>
                    <input
                      type="text"
                      placeholder="John Doe"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      className="mt-1 w-full rounded-lg border px-3 py-2 outline-none ring-emerald-200 focus:ring"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-800">Username</label>
                    <input
                      type="text"
                      placeholder="john_23"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      className="mt-1 w-full rounded-lg border px-3 py-2 outline-none ring-emerald-200 focus:ring"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-sm font-medium text-gray-800">Location</label>
                    <button
                      type="button"
                      onClick={useMyLocation}
                      disabled={geoLocating}
                      className="text-xs text-emerald-700 hover:underline disabled:opacity-60"
                    >
                      {geoLocating ? "Locating..." : "Use my location"}
                    </button>
                  </div>

                  <div className="relative mt-1">
                    <input
                      type="text"
                      placeholder="Search a place (e.g. Colombo, Sri Lanka)"
                      value={location}
                      onChange={(e) => {
                        setLocation(e.target.value);
                        setLocationCoords(null);
                        setGeoOpen(true);
                      }}
                      onFocus={() => setGeoOpen(true)}
                      onBlur={() => setTimeout(() => setGeoOpen(false), 150)}
                      required
                      className="w-full rounded-lg border px-3 py-2 pr-10 outline-none ring-emerald-200 focus:ring"
                    />
                    <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-400">
                      ⌕
                    </div>

                    {geoOpen && (geoLoading || geoResults.length > 0 || geoError) && (
                      <div className="absolute z-10 mt-2 w-full overflow-hidden rounded-lg border bg-white shadow-lg">
                        {geoError && (
                          <div className="px-3 py-2 text-sm text-red-700">{geoError}</div>
                        )}
                        {geoLoading && (
                          <div className="px-3 py-2 text-sm text-gray-600">Searching...</div>
                        )}
                        {!geoLoading && !geoError && geoResults.length === 0 && (
                          <div className="px-3 py-2 text-sm text-gray-600">
                            No results. Keep typing…
                          </div>
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
                      : "Tip: select a suggestion to save coordinates."}
                  </div>
                </div>
              </div>
            </div>
          )}

          {mode === "signup" && (
            <div className="mb-6 grid gap-4">
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-800">
                    Preferred sports
                  </label>
                  <div className="text-xs text-gray-500">{preferredSports.length} selected</div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {SPORTS_OPTIONS.map((sport) => {
                    const active = preferredSports.includes(sport);
                    return (
                      <button
                        key={sport}
                        type="button"
                        onClick={() => toggleSport(sport)}
                        className={[
                          "rounded-full border px-3 py-1 text-sm transition",
                          active
                            ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                            : "border-gray-200 bg-white text-gray-800 hover:bg-gray-50",
                        ].join(" ")}
                        aria-pressed={active}
                      >
                        {sport}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-800">Skill level</label>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {SKILL_LEVEL_OPTIONS.map((opt) => {
                    const active = skillLevel === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setSkillLevel(opt.value)}
                        className={[
                          "rounded-xl border px-3 py-3 text-left text-sm transition",
                          active
                            ? "border-emerald-600 bg-emerald-50"
                            : "border-gray-200 bg-white hover:bg-gray-50",
                        ].join(" ")}
                        aria-pressed={active}
                      >
                        <div className="font-semibold text-gray-900">{opt.label}</div>
                        <div className="mt-0.5 text-xs text-gray-600">
                          {opt.value === "beginner" && "Just starting"}
                          {opt.value === "intermediate" && "Play regularly"}
                          {opt.value === "advanced" && "Competitive level"}
                          {opt.value === "pro" && "Professional"}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-3">
            <div>
              <label className="text-sm font-medium text-gray-800">Email</label>
              <input
                type="email"
                placeholder="you@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1 w-full rounded-lg border px-3 py-2 outline-none ring-emerald-200 focus:ring"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-800">Password</label>
              <input
                type="password"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="mt-1 w-full rounded-lg border px-3 py-2 outline-none ring-emerald-200 focus:ring"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-5 w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-2.5 text-white shadow-sm hover:from-emerald-700 hover:to-teal-700 disabled:opacity-60"
          >
            {submitting ? "Please wait..." : mode === "login" ? "Login" : "Create account"}
          </button>

          {message && (
            <div
              className={[
                "mt-4 rounded-lg border px-3 py-2 text-sm",
                message.type === "success"
                  ? "border-green-200 bg-green-50 text-green-800"
                  : "border-red-200 bg-red-50 text-red-800",
              ].join(" ")}
            >
              {message.text}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
