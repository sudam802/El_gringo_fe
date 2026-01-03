import { createHash } from "crypto";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";

export type AvatarMeta = {
  contentType: string;
  filename: string;
  size: number;
  updatedAt: number;
};

const MAX_BYTES = 5 * 1024 * 1024;

function hashUserId(userId: string) {
  return createHash("sha256").update(userId).digest("hex");
}

function baseDir() {
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

export async function readAvatarMeta(userId: string): Promise<AvatarMeta | null> {
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
