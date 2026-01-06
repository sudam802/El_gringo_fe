import jwt from "jsonwebtoken";
import { db } from "./db.js";

export const COOKIE_NAME = "bp_token";

export function signToken(userId) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Missing JWT_SECRET");
  return jwt.sign({ userId }, secret, { expiresIn: "7d" });
}

export function verifyToken(token) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Missing JWT_SECRET");
  return jwt.verify(token, secret);
}

export function setAuthCookie(res, token) {
  const secure = String(process.env.COOKIE_SECURE ?? "false").toLowerCase() === "true";
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

export function clearAuthCookie(res) {
  const secure = String(process.env.COOKIE_SECURE ?? "false").toLowerCase() === "true";
  res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: "lax", secure, path: "/" });
}

export async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) return res.status(401).json({ message: "Not authenticated" });

    const payload = verifyToken(token);
    const userId = payload?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    await db.read();
    const user = db.data.users.find((u) => u.id === userId);
    if (!user) return res.status(401).json({ message: "Not authenticated" });

    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ message: "Not authenticated" });
  }
}

