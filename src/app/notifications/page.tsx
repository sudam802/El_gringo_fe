"use client";

import { useRouter } from "next/navigation";

export default function NotificationsPage() {
  const router = useRouter();
  return (
    <div className="min-h-screen">
      <div className="app-container py-12">
        <div className="app-card p-8">
          <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
          <p className="mt-2 text-slate-600">This screen is coming next.</p>
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="btn-primary px-4 py-2 text-sm"
            >
              Back to dashboard
            </button>
            <button
              type="button"
              onClick={() => router.push("/events")}
              className="btn-secondary px-4 py-2 text-sm"
            >
              Open events
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

