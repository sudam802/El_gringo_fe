import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { initDb } from "./db.js";
import { authRouter } from "./routes/auth.js";
import { partnersRouter } from "./routes/partners.js";
import { friendsRouter } from "./routes/friends.js";

const app = express();

const port = Number(process.env.PORT ?? 5000);
const origin = process.env.FRONTEND_ORIGIN ?? "http://localhost:3000";

app.use(
  cors({
    origin,
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRouter);
app.use("/api/partners", partnersRouter);
app.use("/api/friends", friendsRouter);

app.use((err, _req, res, _next) => {
  void _next;
  console.error(err);
  res.status(500).json({ message: "Server error" });
});

await initDb();
app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
  console.log(`CORS origin: ${origin}`);
});
