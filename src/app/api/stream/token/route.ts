import { NextResponse } from "next/server";
import { StreamChat } from "stream-chat";
import { avatarPathname, readAvatarMeta } from "@/lib/avatarStore";
import {
  type BackendMeResponse,
  fetchBackendMe,
  getUserIdFromMe,
  getUserNameFromMe,
} from "@/lib/backendMe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requestOrigin(req: Request) {
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

function envPresence() {
  const streamApiKey = process.env.STREAM_API_KEY;
  const nextPublicStreamApiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;
  const streamApiSecret = process.env.STREAM_API_SECRET;
  return {
    VERCEL_ENV: process.env.VERCEL_ENV ?? null,
    NODE_ENV: process.env.NODE_ENV ?? null,
    has_STREAM_API_KEY: Boolean(streamApiKey && streamApiKey.trim()),
    has_NEXT_PUBLIC_STREAM_API_KEY: Boolean(nextPublicStreamApiKey && nextPublicStreamApiKey.trim()),
    has_STREAM_API_SECRET: Boolean(streamApiSecret && streamApiSecret.trim()),
  };
}

function coerceString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value;
  return null;
}

async function fetchBackendFriendStatus(req: Request, otherUserId: string) {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (!backendUrl) {
    return new Response(JSON.stringify({ message: "Missing NEXT_PUBLIC_BACKEND_URL" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const cookie = req.headers.get("cookie") ?? "";
  const authorization = req.headers.get("authorization") ?? "";
  const headers: Record<string, string> = {};
  if (cookie) headers.cookie = cookie;
  if (authorization) headers.authorization = authorization;

  const qs = new URLSearchParams({ userId: otherUserId });
  const base = String(backendUrl).trim().replace(/\/+$/, "");
  return fetch(`${base}/api/friends/status?${qs.toString()}`, {
    headers: Object.keys(headers).length ? headers : undefined,
    cache: "no-store",
  });
}

export async function GET(req: Request) {
  const apiKey = process.env.STREAM_API_KEY ?? process.env.NEXT_PUBLIC_STREAM_API_KEY;
  const apiSecret = process.env.STREAM_API_SECRET;

  if (!apiKey) {
    return NextResponse.json(
      { message: "Missing STREAM_API_KEY / NEXT_PUBLIC_STREAM_API_KEY", debug: envPresence() },
      { status: 500 }
    );
  }
  if (!apiSecret) {
    return NextResponse.json(
      { message: "Missing STREAM_API_SECRET", debug: envPresence() },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(req.url);
  const partnerId = coerceString(searchParams.get("partnerId"));
  const partnerName = coerceString(searchParams.get("partnerName"));

  const meRes = await fetchBackendMe(req);

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
  const origin = requestOrigin(req);

  const myAvatarMeta = await readAvatarMeta(userId);
  const myImage = myAvatarMeta
    ? `${origin}${avatarPathname(userId, myAvatarMeta.updatedAt)}`
    : undefined;

  let channelId: string | null = null;
  if (partnerId) {
    const statusRes = await fetchBackendFriendStatus(req, partnerId);
    if (statusRes.status === 401) {
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    }
    if (!statusRes.ok) {
      return NextResponse.json({ message: "Failed to check friendship status" }, { status: 502 });
    }
    const statusPayload = (await statusRes.json()) as { status?: string; canMessage?: boolean };
    if (!statusPayload?.canMessage) {
      return NextResponse.json(
        { message: "You can only message accepted friends" },
        { status: 403 }
      );
    }

    const members = [userId, partnerId];
    channelId = members.slice().sort().join("__");

    const partnerAvatarMeta = await readAvatarMeta(partnerId);
    const partnerImage = partnerAvatarMeta
      ? `${origin}${avatarPathname(partnerId, partnerAvatarMeta.updatedAt)}`
      : undefined;

    await serverClient.upsertUsers([
      { id: userId, name, ...(myImage ? { image: myImage } : {}) },
      {
        id: partnerId,
        name: partnerName ?? "Partner",
        ...(partnerImage ? { image: partnerImage } : {}),
      },
    ]);

    const channel = serverClient.channel("messaging", channelId, { members });
    try {
      await channel.create();
    } catch {
      // If it already exists, create() can fail in some cases; we only need it to exist.
    }
  } else {
    await serverClient.upsertUsers([
      { id: userId, name, ...(myImage ? { image: myImage } : {}) },
    ]);
  }

  return NextResponse.json({
    apiKey,
    token,
    user: { id: userId, name, ...(myImage ? { image: myImage } : {}) },
    channelId,
  });
}
