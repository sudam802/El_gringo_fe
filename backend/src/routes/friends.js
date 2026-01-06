import express from "express";
import { db } from "../db.js";
import { requireAuth } from "../auth.js";
import { randomUUID } from "crypto";

export const friendsRouter = express.Router();

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

function friendshipKey(a, b) {
  return [a, b].slice().sort().join("__");
}

friendsRouter.get("/", requireAuth, async (req, res) => {
  await db.read();
  const myId = req.user.id;

  const accepted = db.data.friendships.filter(
    (f) => f.key && (f.userAId === myId || f.userBId === myId) && f.status === "accepted"
  );

  const friends = accepted
    .map((f) => (f.userAId === myId ? f.userBId : f.userAId))
    .map((id) => db.data.users.find((u) => u.id === id))
    .filter(Boolean)
    .map(publicUser);

  return res.json({ friends });
});

friendsRouter.get("/requests", requireAuth, async (req, res) => {
  await db.read();
  const myId = req.user.id;

  const pendingIncoming = db.data.friendships.filter(
    (f) => f.status === "pending" && f.addresseeId === myId
  );

  const requests = pendingIncoming
    .map((f) => ({
      from: db.data.users.find((u) => u.id === f.requesterId),
      createdAt: f.createdAt,
    }))
    .filter((r) => r.from)
    .map((r) => ({ from: publicUser(r.from), createdAt: r.createdAt }));

  return res.json({ requests });
});

friendsRouter.post("/request", requireAuth, async (req, res) => {
  const targetId = String(req.body?.userId ?? "").trim();
  const myId = req.user.id;
  if (!targetId) return res.status(400).json({ message: "Missing userId" });
  if (targetId === myId) return res.status(400).json({ message: "Cannot add yourself" });

  await db.read();
  const target = db.data.users.find((u) => u.id === targetId);
  if (!target) return res.status(404).json({ message: "User not found" });

  const key = friendshipKey(myId, targetId);
  const existing = db.data.friendships.find((f) => f.key === key);
  if (existing?.status === "accepted") {
    return res.json({ status: "accepted" });
  }
  if (existing?.status === "pending") {
    if (existing.requesterId === myId) return res.json({ status: "pending" });
    existing.status = "accepted";
    existing.updatedAt = Date.now();
    await db.write();
    return res.json({ status: "accepted" });
  }

  const now = Date.now();
  db.data.friendships.push({
    id: randomUUID(),
    key,
    userAId: [myId, targetId].slice().sort()[0],
    userBId: [myId, targetId].slice().sort()[1],
    requesterId: myId,
    addresseeId: targetId,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  });
  await db.write();
  return res.status(201).json({ status: "pending" });
});

friendsRouter.post("/accept", requireAuth, async (req, res) => {
  const fromUserId = String(req.body?.userId ?? "").trim();
  const myId = req.user.id;
  if (!fromUserId) return res.status(400).json({ message: "Missing userId" });

  await db.read();
  const key = friendshipKey(myId, fromUserId);
  const existing = db.data.friendships.find((f) => f.key === key);
  if (!existing || existing.status !== "pending") {
    return res.status(404).json({ message: "Request not found" });
  }
  if (existing.addresseeId !== myId) {
    return res.status(403).json({ message: "Not allowed" });
  }

  existing.status = "accepted";
  existing.updatedAt = Date.now();
  await db.write();
  return res.json({ status: "accepted" });
});

