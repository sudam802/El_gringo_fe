import { join } from "path";
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import { mkdir } from "fs/promises";

const dataDir = join(process.cwd(), "data");
const dbFile = join(dataDir, "db.json");

const adapter = new JSONFile(dbFile);
export const db = new Low(adapter, { users: [], friendships: [] });

export async function initDb() {
  await mkdir(dataDir, { recursive: true });
  await db.read();
  db.data ||= { users: [], friendships: [] };
  db.data.users ||= [];
  db.data.friendships ||= [];
  await db.write();
}

