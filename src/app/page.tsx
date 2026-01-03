"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import LandingHero from "./components/LandingHero";

export default function HomePage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    const checkAuth = async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/auth/me`,
          { credentials: "include", signal: controller.signal }
        );

        if (res.ok) {
          router.replace("/find-partner");
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
