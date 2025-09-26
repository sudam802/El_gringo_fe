"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

export default function Navbar() {
  const router = useRouter();
  const [user, setUser] = useState<null | { username: string; email: string }>(null);

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/auth/me`, {
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

    const onAuthEvent = () => {
      checkAuth();
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === "auth") {
        checkAuth();
      }
    };

    window.addEventListener("auth", onAuthEvent);
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("auth", onAuthEvent);
      window.removeEventListener("storage", onStorage);
    };
  }, [checkAuth]);

  const handleLogout = async () => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/auth/logout`, {
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

  return (
    <nav className="flex justify-between items-center px-8 py-4 shadow-md bg-white">
      <h1
        className="text-2xl font-bold text-blue-600 cursor-pointer"
        onClick={() => router.push("/")}
      >
        🏅 Sports Partner
      </h1>

      <div className="space-x-4">
        {user ? (
          <>
            <span className="text-gray-700 font-medium">
              Hi, {user.username}
            </span>
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
              className="px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600"
            >
              Login
            </button>
            <button
              onClick={() => router.push("/auth/signup")}
              className="px-4 py-2 rounded-lg border border-blue-500 text-blue-500 hover:bg-blue-50"
            >
              Sign Up
            </button>
          </>
        )}
      </div>
    </nav>
  );
}
