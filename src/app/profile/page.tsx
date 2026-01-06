"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import UserAvatar from "@/components/UserAvatar";

type BackendUser = Record<string, unknown>;

function coerceString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value;
  return null;
}

function coerceStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => (typeof v === "string" ? v.trim() : "")).filter(Boolean);
}

function userIdFromBackendUser(user: BackendUser): string | null {
  return (
    coerceString(user._id) ??
    coerceString(user.id) ??
    coerceString(user.email) ??
    coerceString(user.username) ??
    null
  );
}

function nameFromBackendUser(user: BackendUser): string {
  return (
    coerceString(user.username) ??
    coerceString(user.fullName) ??
    coerceString(user.email) ??
    "Me"
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<BackendUser | null>(null);
  const [avatarVersion, setAvatarVersion] = useState<number>(0);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const userId = useMemo(() => (user ? userIdFromBackendUser(user) : null), [user]);
  const name = useMemo(() => (user ? nameFromBackendUser(user) : "Me"), [user]);
  const location = useMemo(() => (user ? coerceString(user.location) : null), [user]);
  const skillLevel = useMemo(() => (user ? coerceString(user.skillLevel) : null), [user]);
  const preferredSports = useMemo(
    () => (user ? coerceStringArray(user.preferredSports) : []),
    [user]
  );

  useEffect(() => {
    try {
      const v = Number(localStorage.getItem("avatar") ?? "0");
      if (Number.isFinite(v) && v > 0) setAvatarVersion(v);
    } catch {}

    const load = async () => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/auth/me`, {
        credentials: "include",
      });
      if (res.status === 401) {
        router.replace("/auth/login");
        return;
      }
      if (!res.ok) {
        setMessage("Failed to load profile");
        return;
      }
      const data = (await res.json()) as { user?: BackendUser };
      setUser(data.user ?? null);
    };

    load().catch(() => setMessage("Failed to load profile"));
  }, [router]);

  const handleUpload = async () => {
    setMessage(null);
    if (!file) {
      setMessage("Pick an image first");
      return;
    }
    if (!userId) {
      setMessage("Missing user id");
      return;
    }

    setSaving(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const res = await fetch("/api/avatar", { method: "POST", body: formData });
      const data = (await res.json()) as { message?: string; avatarUrl?: string };
      if (!res.ok) {
        throw new Error(data.message || "Upload failed");
      }

      const v = Date.now();
      setAvatarVersion(v);
      try {
        localStorage.setItem("avatar", String(v));
      } catch {}
      try {
        window.dispatchEvent(new Event("avatar"));
      } catch {}

      setFile(null);
      setMessage("Profile picture updated");
      void data;
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
        <button
          type="button"
          onClick={() => router.push("/find-partner?stay=1")}
          className="text-sm text-gray-700 hover:underline"
        >
          Back
        </button>
      </div>

      <div className="mt-6 rounded-lg border bg-white p-6">
        <div className="flex items-center gap-4">
          {userId ? (
            <UserAvatar userId={userId} name={name} size={96} version={avatarVersion} />
          ) : (
            <div className="w-24 h-24 rounded-full bg-gray-200" />
          )}

            <div className="min-w-0">
              <div className="font-semibold text-gray-900 truncate">{name}</div>
            {user && coerceString(user.email) && (
              <div className="text-sm text-gray-600 truncate">
                {coerceString(user.email)}
              </div>
            )}
            {(location || skillLevel || preferredSports.length > 0) && (
              <div className="text-sm text-gray-700 mt-2 space-y-1">
                {location && <div>Location: {location}</div>}
                {preferredSports.length > 0 && (
                  <div>Preferred sports: {preferredSports.join(", ")}</div>
                )}
                {skillLevel && <div>Skill level: {skillLevel}</div>}
              </div>
            )}
            <div className="text-xs text-gray-500 mt-1">Upload a JPG/PNG/WebP/GIF/AVIF (max 5MB)</div>
          </div>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:items-center">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm"
          />
          <button
            type="button"
            disabled={saving}
            onClick={handleUpload}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {saving ? "Uploading..." : "Update picture"}
          </button>
        </div>

        {message && <div className="mt-4 text-sm text-gray-800">{message}</div>}
      </div>
    </div>
  );
}
