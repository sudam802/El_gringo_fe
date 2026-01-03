import { NextResponse } from "next/server";
import { StreamChat } from "stream-chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BackendMeResponse =
  | { user?: Record<string, unknown> }
  | Record<string, unknown>;

function coerceString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value;
  return null;
}

function getUserIdFromMe(payload: BackendMeResponse): string | null {
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

function getUserNameFromMe(payload: BackendMeResponse): string {
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

export async function GET(req: Request) {
  const apiKey = process.env.STREAM_API_KEY ?? process.env.NEXT_PUBLIC_STREAM_API_KEY;
  const apiSecret = process.env.STREAM_API_SECRET;
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

  if (!backendUrl) {
    return NextResponse.json(
      { message: "Missing NEXT_PUBLIC_BACKEND_URL" },
      { status: 500 }
    );
  }
  if (!apiKey) {
    return NextResponse.json(
      { message: "Missing STREAM_API_KEY / NEXT_PUBLIC_STREAM_API_KEY" },
      { status: 500 }
    );
  }
  if (!apiSecret) {
    return NextResponse.json({ message: "Missing STREAM_API_SECRET" }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const partnerId = coerceString(searchParams.get("partnerId"));
  const partnerName = coerceString(searchParams.get("partnerName"));

  const cookie = req.headers.get("cookie") ?? "";

  const meRes = await fetch(`${backendUrl}/api/auth/me`, {
    headers: cookie ? { cookie } : undefined,
    cache: "no-store",
  });

  if (meRes.status === 401) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }
  if (!meRes.ok) {
    return NextResponse.json(
      { message: "Failed to load session" },
      { status: 502 }
    );
  }

  const payload = (await meRes.json()) as BackendMeResponse;
  const userId = getUserIdFromMe(payload);
  if (!userId) {
    return NextResponse.json(
      { message: "Could not determine user id" },
      { status: 500 }
    );
  }
  const name = getUserNameFromMe(payload);

  const serverClient = StreamChat.getInstance(apiKey, apiSecret);
  const token = serverClient.createToken(userId);

  let channelId: string | null = null;
  if (partnerId) {
    const members = [userId, partnerId];
    channelId = members.slice().sort().join("__");

    await serverClient.upsertUsers([
      { id: userId, name },
      { id: partnerId, name: partnerName ?? "Partner" },
    ]);

    const channel = serverClient.channel("messaging", channelId, { members });
    try {
      await channel.create();
    } catch {
      // If it already exists, create() can fail in some cases; we only need it to exist.
    }
  } else {
    await serverClient.upsertUsers([{ id: userId, name }]);
  }

  return NextResponse.json({
    apiKey,
    token,
    user: { id: userId, name },
    channelId,
  });
}
