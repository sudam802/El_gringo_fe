import { NextResponse } from "next/server";
import { readAvatarBytes, readAvatarMeta } from "@/lib/avatarStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, context: { params: Promise<{ userId: string }> }) {
  const { userId } = await context.params;
  if (!userId) {
    return NextResponse.json({ message: "Missing userId" }, { status: 400 });
  }

  const meta = await readAvatarMeta(userId);
  if (!meta) {
    return NextResponse.json({ message: "Avatar not found" }, { status: 404 });
  }

  try {
    const url = new URL(req.url);
    const cacheControl = url.searchParams.get("v")
      ? "public, max-age=31536000, immutable"
      : "public, max-age=0, must-revalidate";

    if (meta.url) {
      const target = new URL(meta.url);
      const v = url.searchParams.get("v");
      if (v) target.searchParams.set("v", v);
      return NextResponse.redirect(target, { status: 307, headers: { "Cache-Control": cacheControl } });
    }

    const bytes = await readAvatarBytes(meta);
    const body = new Uint8Array(bytes);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": meta.contentType,
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": cacheControl,
      },
    });
  } catch {
    return NextResponse.json({ message: "Avatar not available" }, { status: 404 });
  }
}
