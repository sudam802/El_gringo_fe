"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface AuthFormProps {
  mode: "login" | "signup";
}

export default function AuthForm({ mode }: AuthFormProps) {
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = mode === "login" ? "/api/auth/login" : "/api/auth/register";

    try {
      const body =
        mode === "login"
          ? { email, password }
          : { fullName, username, email, password };

      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}${url}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Error");
      setMessage(data.message);

      // ✅ Redirect after success
      if (mode === "login") router.push("/find-partner");
    } catch (err: any) {
      setMessage(err.message);
    }
  };

  return (
    <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-center">
        {mode === "login" ? "Login" : "Sign Up"}
      </h2>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {mode === "signup" && (
          <>
            <input
              type="text"
              placeholder="Full Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="border rounded-lg p-2"
            />
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="border rounded-lg p-2"
            />
          </>
        )}

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="border rounded-lg p-2"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="border rounded-lg p-2"
        />

        <button
          type="submit"
          className="w-full py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600"
        >
          {mode === "login" ? "Login" : "Sign Up"}
        </button>
      </form>

      {message && (
        <p className="text-center text-sm mt-4 text-green-600">{message}</p>
      )}
    </div>
  );
}
