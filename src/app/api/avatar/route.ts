import { NextResponse } from "next/server";
import { StreamChat } from "stream-chat";
import { fetchBackendMe, getUserIdFromMe, getUserNameFromMe } from "@/lib/backendMe";
import { avatarPathname, saveAvatar } from "@/lib/avatarStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requestOrigin(req: Request) {
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

export async function POST(req: Request) {
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

  const meRes = await fetchBackendMe(req);
  if (meRes.status === 401) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }
  if (!meRes.ok) {
    return NextResponse.json({ message: "Failed to load session" }, { status: 502 });
  }

  const payload = (await meRes.json()) as unknown;
  const userId = getUserIdFromMe(payload as never);
  if (!userId) {
    return NextResponse.json({ message: "Could not determine user id" }, { status: 500 });
  }
  const name = getUserNameFromMe(payload as never);

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ message: "Missing file" }, { status: 400 });
  }

  try {
    const meta = await saveAvatar(userId, file);
    const relative = avatarPathname(userId, meta.updatedAt);
    const image = `${requestOrigin(req)}${relative}`;

    const serverClient = StreamChat.getInstance(apiKey, apiSecret);
    await serverClient.upsertUsers([{ id: userId, name, image }]);

    return NextResponse.json({ avatarUrl: relative });
  } catch (e: unknown) {
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Failed to save avatar" },
      { status: 400 }
    );
  }
}

