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

function coerceString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value;
  return null;
}

export async function GET(req: Request) {
  const apiKey = process.env.STREAM_API_KEY ?? process.env.NEXT_PUBLIC_STREAM_API_KEY;
  const apiSecret = process.env.STREAM_API_SECRET;

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
