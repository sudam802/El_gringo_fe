"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import UserAvatar from "@/components/UserAvatar";
import { authHeader, clearAuthToken } from "@/lib/authToken";

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
  const pathname = usePathname();
  const [user, setUser] = useState<null | BackendUser>(null);
  const [avatarVersion, setAvatarVersion] = useState<number>(0);
  const [mobileOpen, setMobileOpen] = useState(false);

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
        headers: authHeader(),
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
        headers: authHeader(),
      });
      clearAuthToken();
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

  const items = user
    ? [
        { label: "Home", href: "/feed", active: pathname?.startsWith("/feed") },
        { label: "Dashboard", href: "/find-partner?stay=1", active: pathname?.startsWith("/find-partner") },
        { label: "Messages", href: "/chat", active: pathname?.startsWith("/chat") },
        { label: "Notifications", href: "/events", active: pathname?.startsWith("/events") },
      ]
    : [
        { label: "Home", href: "/", active: pathname === "/" },
        { label: "Messages", href: "/chat", active: pathname?.startsWith("/chat") },
        { label: "Events", href: "/events", active: pathname?.startsWith("/events") },
      ];

  const go = (href: string) => {
    setMobileOpen(false);
    router.push(href);
  };

  return (
    <nav className="sticky top-0 z-50 py-3">
      <div className="app-container">
        <div className="rounded-3xl bg-white/70 backdrop-blur ring-1 ring-slate-200/70 shadow-sm">
          <div className="px-3 sm:px-4 py-3 flex items-center gap-3">
            <button
              type="button"
              onClick={() => go(user ? "/feed" : "/")}
              className="inline-flex items-center gap-3"
              aria-label="Go to home"
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-sm shadow-blue-200">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
                  <path
                    d="M7 12.5 12 7.5l5 5v7.2c0 .7-.6 1.3-1.3 1.3H8.3c-.7 0-1.3-.6-1.3-1.3v-7.2Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M5 10.2 12 4l7 6.2"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span className="hidden sm:block text-base font-semibold text-slate-900">
                ElGringo
              </span>
            </button>

            <div className="flex-1 flex items-center justify-center">
              <div className="hidden md:flex items-center gap-2">
                {items.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => go(item.href)}
                    className={[
                      "relative px-3 py-2 text-sm font-semibold transition",
                      item.active ? "text-slate-900" : "text-slate-500 hover:text-slate-900",
                      item.active
                        ? "after:absolute after:left-3 after:right-3 after:-bottom-1 after:h-0.5 after:rounded-full after:bg-blue-600"
                        : "",
                    ].join(" ")}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/70 ring-1 ring-slate-200 hover:bg-white"
                onClick={() => setMobileOpen((v) => !v)}
                aria-expanded={mobileOpen}
                aria-label="Open menu"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
                  <path d="M5 7h14M5 12h14M5 17h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>

              {user ? (
                <>
                  <button
                    type="button"
                    onClick={() => go("/events")}
                    className="hidden sm:inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/70 ring-1 ring-slate-200 hover:bg-white"
                    aria-label="Notifications"
                    title="Notifications"
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
                      <path
                        d="M12 22a2.4 2.4 0 0 0 2.4-2.4H9.6A2.4 2.4 0 0 0 12 22Z"
                        fill="currentColor"
                        opacity="0.25"
                      />
                      <path
                        d="M18 16.2H6c.9-1 1.5-2.4 1.5-4.1V10a4.5 4.5 0 1 1 9 0v2.1c0 1.7.6 3.1 1.5 4.1Z"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>

                  <button
                    type="button"
                    onClick={() => go("/profile")}
                    className="inline-flex items-center gap-2 rounded-2xl px-2 py-1.5 hover:bg-white/60"
                    title="Profile"
                  >
                    {userId ? (
                      <UserAvatar userId={userId} name={displayName} version={avatarVersion} />
                    ) : (
                      <span className="inline-block h-9 w-9 rounded-full bg-slate-200" />
                    )}
                    <span className="hidden lg:block text-sm font-semibold text-slate-700 max-w-40 truncate">
                      {displayName}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="hidden sm:inline-flex rounded-2xl bg-white/70 px-4 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-white"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <div className="hidden sm:flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => go("/auth/login")}
                    className="btn-soft"
                  >
                    Login
                  </button>
                  <button
                    type="button"
                    onClick={() => go("/auth/signup")}
                    className="rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-blue-200 hover:from-blue-700 hover:to-indigo-700"
                  >
                    Sign Up
                  </button>
                </div>
              )}
            </div>
          </div>

          {mobileOpen ? (
            <div className="md:hidden border-t border-slate-200/70 px-3 py-3">
              <div className="grid gap-1">
                {items.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => go(item.href)}
                    className={[
                      "w-full rounded-2xl px-4 py-2 text-left text-sm font-semibold transition",
                      item.active ? "bg-blue-50 text-slate-900 ring-1 ring-blue-200" : "text-slate-700 hover:bg-white/70",
                    ].join(" ")}
                  >
                    {item.label}
                  </button>
                ))}

                {user ? (
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="mt-1 w-full rounded-2xl px-4 py-2 text-left text-sm font-semibold text-red-700 ring-1 ring-red-200 hover:bg-red-50"
                  >
                    Logout
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => go("/auth/login")}
                      className="mt-1 w-full rounded-2xl px-4 py-2 text-left text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-white/70"
                    >
                      Login
                    </button>
                    <button
                      type="button"
                      onClick={() => go("/auth/signup")}
                      className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-left text-sm font-semibold text-white shadow-sm shadow-blue-200 hover:from-blue-700 hover:to-indigo-700"
                    >
                      Sign Up
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </nav>
  );
}
