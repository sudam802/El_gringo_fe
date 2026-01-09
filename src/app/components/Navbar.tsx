"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import UserAvatar from "@/components/UserAvatar";

type BackendUser = Record<string, unknown>;

function coerceString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value;
  return null;
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

export default function Navbar() {
  const router = useRouter();
  const [user, setUser] = useState<null | BackendUser>(null);
  const [avatarVersion, setAvatarVersion] = useState<number>(0);

  const checkAuth = useCallback(async () => {
    try {
      const base = String(process.env.NEXT_PUBLIC_BACKEND_URL || "").trim().replace(/\/+$/, "");
      if (!base) {
        console.error("Missing NEXT_PUBLIC_BACKEND_URL (set it in Vercel env vars and redeploy)");
        setUser(null);
        return;
      }
      const res = await fetch(`${base}/api/auth/me`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user || null);
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error("Auth check failed", err);
      setUser(null);
    }
  }, []);

  // On mount, check auth and subscribe to auth/storage events
  useEffect(() => {
    checkAuth();
    try {
      const v = Number(localStorage.getItem("avatar") ?? "0");
      if (Number.isFinite(v) && v > 0) setAvatarVersion(v);
    } catch {}

    const onAuthEvent = () => checkAuth();
    const onAvatarEvent = () => {
      const v = Date.now();
      setAvatarVersion(v);
      try {
        localStorage.setItem("avatar", String(v));
      } catch {}
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === "auth") {
        checkAuth();
      }
      if (e.key === "avatar") {
        const v = Number(e.newValue ?? "0");
        if (Number.isFinite(v) && v > 0) setAvatarVersion(v);
      }
    };

    window.addEventListener("auth", onAuthEvent);
    window.addEventListener("avatar", onAvatarEvent);
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("auth", onAuthEvent);
      window.removeEventListener("avatar", onAvatarEvent);
      window.removeEventListener("storage", onStorage);
    };
  }, [checkAuth]);

  const handleLogout = async () => {
    try {
      const base = String(process.env.NEXT_PUBLIC_BACKEND_URL || "").trim().replace(/\/+$/, "");
      if (!base) throw new Error("Missing NEXT_PUBLIC_BACKEND_URL");
      await fetch(`${base}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
      setUser(null);
      // notify other parts of the app
      try { window.dispatchEvent(new Event("auth")); } catch {}
      // Optionally clear a shared key
      try { localStorage.removeItem("auth"); } catch {}
      router.push("/");
    } catch (err) {
      console.error("Logout failed", err);
    }
  };

  const userId = user ? userIdFromBackendUser(user) : null;
  const displayName =
    (user && (coerceString(user.username) ?? coerceString(user.fullName) ?? coerceString(user.email))) ||
    "Account";

  return (
    <nav className="flex justify-between items-center px-8 py-4 shadow-md bg-white">
      <h1
        className="text-2xl font-bold text-emerald-600 cursor-pointer"
        onClick={() => router.push(user ? "/feed" : "/")}
      >
        🏅 Sports Partner
      </h1>

      <div className="space-x-4">
        {user ? (
          <>
            <button
              type="button"
              onClick={() => router.push("/feed")}
              className="px-4 py-2 rounded-lg bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
            >
              Feed
            </button>
            <button
              type="button"
              onClick={() => router.push("/chat")}
              className="px-4 py-2 rounded-lg bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
            >
              Chat
            </button>
            <button
              type="button"
              onClick={() => router.push("/find-partner?stay=1")}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
            >
              Find Partner
            </button>
            <button
              type="button"
              onClick={() => router.push("/profile")}
              className="inline-flex items-center gap-2 align-middle"
              title="Profile"
            >
              {userId ? (
                <UserAvatar userId={userId} name={displayName} version={avatarVersion} />
              ) : (
                <span className="inline-block w-8 h-8 rounded-full bg-gray-200" />
              )}
              <span className="text-gray-700 font-medium">Hi, {displayName}</span>
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600"
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => router.push("/auth/login")}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
            >
              Login
            </button>
            <button
              onClick={() => router.push("/auth/signup")}
              className="px-4 py-2 rounded-lg border border-emerald-600 text-emerald-700 hover:bg-emerald-50"
            >
              Sign Up
            </button>
          </>
        )}
      </div>
    </nav>
  );
}
