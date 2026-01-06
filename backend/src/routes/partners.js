import express from "express";
import { db } from "../db.js";
import { requireAuth } from "../auth.js";

export const partnersRouter = express.Router();

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

function hasRelationship(friendships, myId, otherId) {
  return friendships.some(
    (f) =>
      (f.userAId === myId && f.userBId === otherId) ||
      (f.userAId === otherId && f.userBId === myId) ||
      (f.requesterId === myId && f.addresseeId === otherId) ||
      (f.requesterId === otherId && f.addresseeId === myId)
  );
}

partnersRouter.get("/find-partner", requireAuth, async (req, res) => {
  const q = String(req.query?.q ?? "").trim().toLowerCase();
  const skill = String(req.query?.skill ?? "").trim().toLowerCase();
  const location = String(req.query?.location ?? "").trim().toLowerCase();

  await db.read();
  const myId = req.user.id;
  const friendships = db.data.friendships;

  let users = db.data.users.filter((u) => u.id !== myId);
  users = users.filter((u) => !hasRelationship(friendships, myId, u.id));

  if (q) {
    users = users.filter((u) => {
      const hay = `${u.username ?? ""} ${u.fullName ?? ""} ${u.email ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }
  if (skill) {
    users = users.filter((u) => String(u.skill ?? "").toLowerCase().includes(skill));
  }
  if (location) {
    users = users.filter((u) => String(u.location ?? "").toLowerCase().includes(location));
  }

  return res.json({ partners: users.slice(0, 50).map(publicUser) });
});

