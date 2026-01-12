"use client";

import AuthForm from "@/components/AuthForm";

export default function SignupPage() {
  return (
    <div className="flex items-center justify-center min-h-full px-4 py-10">
      <AuthForm mode="signup" />
    </div>
  );
}
