"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type Props = {
  userId: string;
  name: string;
  size?: number;
  version?: number;
  className?: string;
};

function initialsFromName(name: string) {
  const parts = name
    .split(" ")
    .map((p) => p.trim())
    .filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const second = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
  return `${first}${second}`.toUpperCase();
}

export default function UserAvatar({
  userId,
  name,
  size = 32,
  version,
  className,
}: Props) {
  const [failed, setFailed] = useState(false);

  const src = useMemo(() => {
    const base = `/api/avatar/${encodeURIComponent(userId)}`;
    if (!version) return base;
    return `${base}?v=${version}`;
  }, [userId, version]);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const initials = useMemo(() => initialsFromName(name || "Me"), [name]);

  if (failed) {
    return (
      <div
        className={`inline-flex items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-semibold ${className ?? ""}`}
        style={{ width: size, height: size, fontSize: Math.max(12, Math.floor(size / 2.4)) }}
        aria-label={name}
        title={name}
      >
        {initials}
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={name}
      width={size}
      height={size}
      className={`rounded-full object-cover bg-gray-100 ${className ?? ""}`}
      onError={() => setFailed(true)}
      loading="lazy"
      unoptimized
    />
  );
}
