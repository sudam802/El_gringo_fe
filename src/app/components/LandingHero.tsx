"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";

export default function LandingHero() {
  const router = useRouter();

  return (
    <section className="w-full bg-gradient-to-b from-slate-50 via-white to-blue-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-20 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
        <div className="rounded-3xl bg-white/80 ring-1 ring-slate-200/70 shadow-lg shadow-slate-200/60 p-7 sm:p-10 backdrop-blur">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-800 ring-1 ring-blue-200">
            Find partners faster
          </div>

          <h1 className="mt-5 text-4xl sm:text-5xl font-bold text-slate-900 leading-tight">
            Find Sports Partners
            <br />
            <span className="bg-gradient-to-r from-blue-700 to-indigo-600 bg-clip-text text-transparent">
              Near You
            </span>
          </h1>

          <p className="mt-4 text-base sm:text-lg text-slate-600 max-w-xl">
            Match with players based on sport, skill level, and availability. Never skip a game
            because you couldn’t find teammates.
          </p>

          <div className="mt-7 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => router.push("/auth/signup")}
              className="btn-primary text-sm sm:text-base"
            >
              Get Started
            </button>

            <button
              type="button"
              onClick={() => router.push("/auth/login")}
              className="btn-secondary text-sm sm:text-base"
            >
              Login
            </button>
          </div>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm text-slate-700">
            <div className="rounded-2xl bg-white/70 ring-1 ring-slate-200/70 px-4 py-3">
              <div className="font-semibold text-slate-900">Smart matching</div>
              <div className="mt-1 text-slate-600">Sport, level, schedule</div>
            </div>
            <div className="rounded-2xl bg-white/70 ring-1 ring-slate-200/70 px-4 py-3">
              <div className="font-semibold text-slate-900">Meetups & events</div>
              <div className="mt-1 text-slate-600">Join games nearby</div>
            </div>
            <div className="rounded-2xl bg-white/70 ring-1 ring-slate-200/70 px-4 py-3">
              <div className="font-semibold text-slate-900">Chat instantly</div>
              <div className="mt-1 text-slate-600">Plan your next match</div>
            </div>
          </div>
        </div>

        <div className="relative w-full h-[340px] sm:h-[420px] rounded-3xl overflow-hidden shadow-xl shadow-slate-200/60 ring-1 ring-slate-200/70">
          <div className="absolute inset-0 bg-gradient-to-tr from-blue-600/20 via-transparent to-indigo-600/20" />
          <Image
            src="/hero-sport.png"
            alt="People playing sports together"
            fill
            className="object-cover"
            sizes="(max-width: 1024px) 100vw, 50vw"
            priority
          />
        </div>
      </div>
    </section>
  );
}
