import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ReviewItem, ScoutedPost, SessionStats } from "./types.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const DATA_DIR = join(ROOT, "data");

function load<T>(file: string, fallback: T): T {
  const p = join(DATA_DIR, file);
  if (!existsSync(p)) return fallback;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function save<T>(file: string, data: T): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(join(DATA_DIR, file), JSON.stringify(data, null, 2), "utf8");
}

export const queue = {
  all: (): ReviewItem[] => load<ReviewItem[]>("queue.json", []),
  pending: (): ReviewItem[] => queue.all().filter((i) => i.status === "pending"),
  add: (item: ReviewItem): void => save("queue.json", [...queue.all(), item]),
  update: (id: string, patch: Partial<ReviewItem>): void =>
    save(
      "queue.json",
      queue.all().map((i) => (i.id === id ? { ...i, ...patch } : i)),
    ),
};

export const processed = {
  ids: (): Set<string> => new Set(load<string[]>("processed_ids.json", [])),
  has: (id: string): boolean => processed.ids().has(id),
  mark: (id: string): void => save("processed_ids.json", [...processed.ids(), id]),
};

export const history = {
  scouted: (): ScoutedPost[] => load<ScoutedPost[]>("history.json", []),
  pushScouted: (p: ScoutedPost): void => save("history.json", [...history.scouted(), p]),
  sessions: (): SessionStats[] => load<SessionStats[]>("sessions.json", []),
  saveSession: (s: SessionStats): void =>
    save(
      "sessions.json",
      [...history.sessions().filter((x) => x.session_id !== s.session_id), s],
    ),
};
