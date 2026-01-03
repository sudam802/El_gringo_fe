export type BackendMeResponse =
  | { user?: Record<string, unknown> }
  | Record<string, unknown>;

function coerceString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value;
  return null;
}

export function getUserIdFromMe(payload: BackendMeResponse): string | null {
  const rawUser =
    typeof payload === "object" && payload && "user" in payload
      ? (payload as { user?: unknown }).user
      : payload;
  if (!rawUser || typeof rawUser !== "object") return null;

  const obj = rawUser as Record<string, unknown>;
  return (
    coerceString(obj._id) ??
    coerceString(obj.id) ??
    coerceString(obj.email) ??
    coerceString(obj.username) ??
    null
  );
}

export function getUserNameFromMe(payload: BackendMeResponse): string {
  const rawUser =
    typeof payload === "object" && payload && "user" in payload
      ? (payload as { user?: unknown }).user
      : payload;
  if (!rawUser || typeof rawUser !== "object") return "Me";

  const obj = rawUser as Record<string, unknown>;
  return (
    coerceString(obj.username) ??
    coerceString(obj.fullName) ??
    coerceString(obj.email) ??
    "Me"
  );
}

export async function fetchBackendMe(req: Request): Promise<Response> {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (!backendUrl) {
    return new Response(
      JSON.stringify({ message: "Missing NEXT_PUBLIC_BACKEND_URL" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const cookie = req.headers.get("cookie") ?? "";
  return fetch(`${backendUrl}/api/auth/me`, {
    headers: cookie ? { cookie } : undefined,
    cache: "no-store",
  });
}

