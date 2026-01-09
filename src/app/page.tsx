"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import LandingHero from "./components/LandingHero";
import { authHeader } from "@/lib/authToken";

export default function HomePage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const base = String(process.env.NEXT_PUBLIC_BACKEND_URL || "").trim().replace(/\/+$/, "");

    const checkAuth = async () => {
      try {
        if (!base) throw new Error("Missing NEXT_PUBLIC_BACKEND_URL");
        const res = await fetch(
          `${base}/api/auth/me`,
          { credentials: "include", headers: authHeader(), signal: controller.signal }
        );

        if (res.ok) {
          router.replace("/feed");
          return;
        }
      } catch {
        // ignore network/abort errors and fall back to landing page
      } finally {
        setCheckingAuth(false);
      }
    };

    checkAuth();
    return () => controller.abort();
  }, [router]);

  if (checkingAuth) {
    return (
      <main className="min-h-screen flex items-center justify-center text-gray-500">
        Loading…
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <LandingHero />
    </main>
  );
}
