"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import LandingHero from "./components/LandingHero";
import { authHeader } from "@/lib/authToken";
import { getBackendBaseUrl } from "@/lib/backendBaseUrl";

export default function HomePage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const base = getBackendBaseUrl();

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
      <div className="min-h-full flex items-center justify-center text-gray-500">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-full">
      <LandingHero />
    </div>
  );
}
