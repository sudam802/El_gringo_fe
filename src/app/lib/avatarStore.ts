import { createHash } from "crypto";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";

export type AvatarMeta = {
  contentType: string;
  filename: string;
  size: number;
  updatedAt: number;
  url?: string;
};

const MAX_BYTES = 5 * 1024 * 1024;

function hashUserId(userId: string) {
  return createHash("sha256").update(userId).digest("hex");
}

function isVercelRuntime() {
  return Boolean(process.env.VERCEL || process.env.VERCEL_ENV);
}

function blobStorageEnabled() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function baseDir() {
  if (isVercelRuntime()) return path.join("/tmp", "uploads", "avatars");
  return path.join(process.cwd(), "uploads", "avatars");
}

function metaPath(userId: string) {
  return path.join(baseDir(), `${hashUserId(userId)}.json`);
}

function filePath(filename: string) {
  return path.join(baseDir(), filename);
}

function extForContentType(contentType: string) {
  switch (contentType) {
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "image/gif":
      return ".gif";
    case "image/avif":
      return ".avif";
    default:
      return null;
  }
}

function contentTypeFromExt(ext: string): string {
  switch (ext.toLowerCase()) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".avif":
      return "image/avif";
    default:
      return "application/octet-stream";
  }
}

type ListedBlob = {
  url: string;
  pathname: string;
  size?: number;
  uploadedAt?: string;
  contentType?: string;
};

function updatedAtFromBlobPathname(pathname: string): number | null {
  const base = pathname.split("/").pop() ?? "";
  const ts = base.split(".")[0] ?? "";
  const n = Number(ts);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function readAvatarMeta(userId: string): Promise<AvatarMeta | null> {
  if (blobStorageEnabled()) {
    try {
      const { list } = await import("@vercel/blob");
      const prefix = `avatars/${hashUserId(userId)}/`;
      const res = (await list({ prefix, limit: 50 })) as unknown as { blobs?: ListedBlob[] };
      const blobs = Array.isArray(res?.blobs) ? res.blobs : [];
      if (blobs.length === 0) return null;

      const sorted = blobs
        .map((b) => ({ blob: b, updatedAt: updatedAtFromBlobPathname(b.pathname) ?? 0 }))
        .sort((a, b) => b.updatedAt - a.updatedAt);

      const winner = sorted[0]?.blob;
      const updatedAt = sorted[0]?.updatedAt ?? 0;
      if (!winner?.url || !winner?.pathname || !updatedAt) return null;

      const ext = path.extname(winner.pathname);
      const contentType = winner.contentType ?? contentTypeFromExt(ext);

      return {
        contentType,
        filename: winner.pathname,
        size: typeof winner.size === "number" ? winner.size : 0,
        updatedAt,
        url: winner.url,
      };
    } catch {
      // fall through to filesystem
    }
  }

  try {
    const raw = await readFile(metaPath(userId), "utf8");
    const parsed = JSON.parse(raw) as AvatarMeta;
    if (!parsed?.filename || !parsed?.contentType) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function avatarPathname(userId: string, updatedAt?: number) {
  const pathname = `/api/avatar/${encodeURIComponent(userId)}`;
  return updatedAt ? `${pathname}?v=${updatedAt}` : pathname;
}

export async function readAvatarBytes(meta: AvatarMeta) {
  return readFile(filePath(meta.filename));
}

export async function saveAvatar(userId: string, file: File): Promise<AvatarMeta> {
  if (!userId) throw new Error("Missing user id");
  if (!(file instanceof File)) throw new Error("Missing file");
  if (!file.type?.startsWith("image/")) throw new Error("File must be an image");
  if (file.size > MAX_BYTES) throw new Error("Image is too large (max 5MB)");

  const ext = extForContentType(file.type);
  if (!ext) throw new Error("Unsupported image type");

  if (blobStorageEnabled()) {
    const { put, list, del } = await import("@vercel/blob");
    const updatedAt = Date.now();
    const hashed = hashUserId(userId);
    const pathname = `avatars/${hashed}/${updatedAt}${ext}`;

    const bytes = await file.arrayBuffer();
    const uploaded = await put(pathname, Buffer.from(bytes), {
      access: "public",
      contentType: file.type,
      addRandomSuffix: false,
    });

    try {
      const res = (await list({ prefix: `avatars/${hashed}/`, limit: 100 })) as unknown as {
        blobs?: ListedBlob[];
      };
      const blobs = Array.isArray(res?.blobs) ? res.blobs : [];
      const keep = new Set(
        blobs
          .map((b) => ({ b, t: updatedAtFromBlobPathname(b.pathname) ?? 0 }))
          .sort((a, b) => b.t - a.t)
          .slice(0, 5)
          .map((x) => x.b.pathname)
      );
      await Promise.all(
        blobs
          .filter((b) => b.pathname && !keep.has(b.pathname))
          .map((b) => del(b.url).catch(() => {}))
      );
    } catch {
      // ignore cleanup errors
    }

    return {
      contentType: file.type,
      filename: pathname,
      size: file.size,
      updatedAt,
      url: uploaded.url,
    };
  }

  const dir = baseDir();
  await mkdir(dir, { recursive: true });

  const previous = await readAvatarMeta(userId);

  const filename = `${hashUserId(userId)}${ext}`;
  const bytes = await file.arrayBuffer();
  await writeFile(filePath(filename), Buffer.from(bytes));

  const meta: AvatarMeta = {
    contentType: file.type,
    filename,
    size: file.size,
    updatedAt: Date.now(),
  };
  await writeFile(metaPath(userId), JSON.stringify(meta), "utf8");

  if (previous?.filename && previous.filename !== filename) {
    unlink(filePath(previous.filename)).catch(() => {});
  }

  return meta;
}
