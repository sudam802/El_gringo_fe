"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";

export default function LandingHero() {
  const router = useRouter();

  return (
    <section className="w-full bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
        
        {/* Left Content */}
        <div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 leading-tight">
            Find Sports Partners <br />
            <span className="text-emerald-600">Near You</span>
          </h1>

          <p className="mt-4 text-lg text-gray-600 max-w-xl">
            Match with players based on sport, skill level, and availability.
            Never skip a game because you couldn’t find teammates.
          </p>

          <div className="mt-8 flex gap-4">
            <button
              onClick={() => router.push("/auth/signup")}
              className="px-6 py-3 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700"
            >
              Get Started
            </button>

            <button
              onClick={() => router.push("/auth/login")}
              className="px-6 py-3 rounded-lg border border-emerald-600 text-emerald-700 hover:bg-emerald-50"
            >
              Login
            </button>
          </div>
        </div>

        {/* Right Image */}
        <div className="relative w-full h-[320px] md:h-[420px] rounded-2xl overflow-hidden shadow-lg">
          <Image
            src="/hero-sport.png"
            alt="People playing sports together"
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 50vw"
            priority
          />
        </div>

      </div>
    </section>
  );
}
