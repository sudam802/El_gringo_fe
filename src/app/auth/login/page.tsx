"use client";

import AuthForm from "@/components/AuthForm";

export default function LoginPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <AuthForm mode="login" />
    </div>
  );
}
