import express from "express";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { db } from "../db.js";
import { clearAuthCookie, requireAuth, setAuthCookie, signToken } from "../auth.js";

export const authRouter = express.Router();

function publicUser(user) {
  return {
    id: user.id,
    _id: user.id,
    email: user.email,
    username: user.username,
    fullName: user.fullName,
    skill: user.skill ?? null,
    location: user.location ?? null,
  };
}

authRouter.post("/register", async (req, res) => {
  const { fullName, username, email, password } = req.body ?? {};
  if (!fullName || !username || !email || !password) {
    return res.status(400).json({ message: "Missing fields" });
  }

  await db.read();
  const emailTaken = db.data.users.some((u) => u.email.toLowerCase() === String(email).toLowerCase());
  if (emailTaken) return res.status(409).json({ message: "Email already in use" });

  const usernameTaken = db.data.users.some(
    (u) => u.username.toLowerCase() === String(username).toLowerCase()
  );
  if (usernameTaken) return res.status(409).json({ message: "Username already in use" });

  const passwordHash = await bcrypt.hash(String(password), 10);
  const user = {
    id: randomUUID(),
    email: String(email).trim(),
    username: String(username).trim(),
    fullName: String(fullName).trim(),
    passwordHash,
    createdAt: Date.now(),
  };

  db.data.users.push(user);
  await db.write();

  const token = signToken(user.id);
  setAuthCookie(res, token);
  return res.status(201).json({ message: "Registered", user: publicUser(user) });
});

authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) return res.status(400).json({ message: "Missing email or password" });

  await db.read();
  const user = db.data.users.find((u) => u.email.toLowerCase() === String(email).toLowerCase());
  if (!user) return res.status(401).json({ message: "Invalid credentials" });

  const ok = await bcrypt.compare(String(password), user.passwordHash);
  if (!ok) return res.status(401).json({ message: "Invalid credentials" });

  const token = signToken(user.id);
  setAuthCookie(res, token);
  return res.json({ message: "Logged in", user: publicUser(user) });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  return res.json({ user: publicUser(req.user) });
});

authRouter.post("/logout", async (_req, res) => {
  clearAuthCookie(res);
  return res.json({ message: "Logged out" });
});

