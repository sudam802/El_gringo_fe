"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navbar */}
      <nav className="flex justify-between items-center px-8 py-4 shadow-md bg-white">
        <h1 className="text-2xl font-bold text-blue-600">🏅 Sports Partner</h1>

        <div className="space-x-4">
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
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex flex-col items-center justify-center flex-grow text-center p-8">
        <h2 className="text-4xl font-extrabold text-gray-800 mb-6">
          Find Your Perfect Sports Partner
        </h2>
        <p className="text-lg text-gray-600 mb-10 max-w-xl">
          Connect with players, coaches, and enthusiasts who share your passion.  
          Build friendships, train together, and grow stronger as a team.
        </p>

        {/* Example hero image */}
        <div className="w-full max-w-2xl">
          <Image
            src="/sports-hero.jpg" // put an image inside public/sports-hero.jpg
            alt="Sports Partner"
            width={800}
            height={400}
            className="rounded-xl shadow-lg"
            priority
          />
        </div>
      </main>
    </div>
  );
}
