function normalizeBaseUrl(value: unknown): string {
  const raw = typeof value === "string" ? value.trim() : "";
  return raw.replace(/\/+$/, "");
}

function looksLikeLocalhost(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname === "[::1]";
  } catch {
    return false;
  }
}

function portFromUrl(url: string, fallback: string): string {
  try {
    const u = new URL(url);
    return u.port || fallback;
  } catch {
    return fallback;
  }
}

function browserDefaultBackendUrl(port: string): string {
  if (typeof window === "undefined") return "";
  const proto = window.location.protocol === "https:" ? "https:" : "http:";
  const host = window.location.hostname;
  return `${proto}//${host}:${port}`;
}

// Client pages in dev often use NEXT_PUBLIC_BACKEND_URL=http://localhost:5000.
// On a phone accessing the dev site via LAN IP, "localhost" points to the phone.
export function getBackendBaseUrl(): string {
  const env = normalizeBaseUrl(process.env.NEXT_PUBLIC_BACKEND_URL);
  if (!env) return browserDefaultBackendUrl("5000");

  if (typeof window !== "undefined" && looksLikeLocalhost(env)) {
    const port = portFromUrl(env, "5000");
    return browserDefaultBackendUrl(port);
  }

  return env;
}

