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
  relevant?: boolean;
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

export interface AgentDef {
  persona: string;
  ownedProduct: string;
  marketingStrategy: string;
  contentWritingRule: string;
}

export interface TenantInfo {
  brandName: string;
  threadsHandle: string;
  onboarded: boolean;
}

export async function fetchConfig(): Promise<TenantConfig> {
  return (await fetch(`${BASE}/config?tenant=${TENANT}`)).json();
}

export async function saveConfig(c: TenantConfig): Promise<void> {
  await fetch(`${BASE}/config?tenant=${TENANT}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(c) });
}

export async function fetchAgentDef(): Promise<AgentDef> {
  const r = await fetch(`${BASE}/agent-def?tenant=${TENANT}`);
  if (!r.ok) throw new Error(`fetch agent-def failed: ${r.status}`);
  return r.json() as Promise<AgentDef>;
}

export async function saveAgentDef(def: AgentDef): Promise<void> {
  const r = await fetch(`${BASE}/agent-def?tenant=${TENANT}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(def),
  });
  if (!r.ok) throw new Error(`save agent-def failed: ${r.status}`);
}

export async function fetchTenant(): Promise<TenantInfo> {
  const r = await fetch(`${BASE}/tenant?tenant=${TENANT}`);
  if (!r.ok) throw new Error(`fetch tenant failed: ${r.status}`);
  return r.json() as Promise<TenantInfo>;
}

export async function onboardTenant(input: { brandName: string; threadsHandle: string; ownedProduct: string }): Promise<void> {
  const r = await fetch(`${BASE}/tenant/onboard?tenant=${TENANT}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!r.ok) throw new Error((await r.text()) || `onboard failed: ${r.status}`);
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

export async function previewResolve(id: string, action: "sent" | "skipped"): Promise<void> {
  const r = await fetch(`${BASE}/api/v1/preview/resolve`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id, action }),
  });
  if (!r.ok) throw new Error(`preview resolve failed: ${r.status}`);
}
