const BASE = "http://127.0.0.1:18900";
const TENANT = "us";

export interface ReviewPost {
  id: string;
  url: string;
  author_handle: string;
  text: string;
  likes: number;
  replies: number;
  posted_at: string;
}

export interface ReviewItem {
  id: string;
  post: ReviewPost;
  reason: string;
  draft: string;
  status: string;
  created_at: string;
}

export interface TenantConfig {
  keywords: string[];
  minLikes: number;
  maxAgeHours: number | null;
  targetRelevant: number;
  excludeKeywords: string[];
  serpType: "default" | "recent";
}

export async function fetchConfig(): Promise<TenantConfig> {
  return (await fetch(`${BASE}/config?tenant=${TENANT}`)).json();
}

export async function saveConfig(c: TenantConfig): Promise<void> {
  await fetch(`${BASE}/config?tenant=${TENANT}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(c) });
}

export async function runScout(keyword?: string): Promise<void> {
  await fetch(`${BASE}/scout?tenant=${TENANT}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ keyword }) });
}

export async function stopScout(): Promise<void> {
  const r = await fetch(`${BASE}/scout/stop?tenant=${TENANT}`, { method: "POST" });
  if (!r.ok) throw new Error(`stop scout failed: ${r.status}`);
}

export async function fetchScoutStatus(): Promise<{ running: boolean }> {
  const r = await fetch(`${BASE}/scout/status?tenant=${TENANT}`);
  if (!r.ok) throw new Error(`fetch scout status failed: ${r.status}`);
  return r.json() as Promise<{ running: boolean }>;
}

export async function fetchReviews(): Promise<ReviewItem[]> {
  const r = await fetch(`${BASE}/reviews?tenant=${TENANT}`);
  if (!r.ok) throw new Error(`fetch reviews failed: ${r.status}`);
  return r.json() as Promise<ReviewItem[]>;
}

export async function updateReview(id: string, patch: { status?: string; draft?: string }): Promise<void> {
  const r = await fetch(`${BASE}/review`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id, ...patch }),
  });
  if (!r.ok) throw new Error(`update review failed: ${r.status}`);
}
