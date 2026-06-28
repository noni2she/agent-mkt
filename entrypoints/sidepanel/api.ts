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

export interface ThreadsAccount {
  id: string;
  tenant_id: string;
  handle: string;
  display_name: string;
  persona: string;
  marketing_strategy: string;
  content_writing_rule: string;
  created_at: string;
}

export interface CreateAccountInput {
  handle: string;
  display_name: string;
  persona: string;
  marketing_strategy?: string;
  content_writing_rule?: string;
}

export interface AccountMismatch {
  actual: string;
  expected: string;
}

export class PreviewingBlockError extends Error {
  readonly previewingCount: number;

  constructor(previewingCount: number) {
    super("目前帳號仍有預覽中的項目，請先處理後再切換帳號");
    this.name = "PreviewingBlockError";
    this.previewingCount = previewingCount;
  }
}

async function responseError(response: Response, fallback: string): Promise<Error> {
  const body = await response.json().catch(() => null) as { error?: unknown } | null;
  return new Error(typeof body?.error === "string" ? body.error : fallback);
}

export async function listAccounts(): Promise<ThreadsAccount[]> {
  const r = await fetch(`${BASE}/api/v1/accounts`);
  if (!r.ok) throw await responseError(r, `list accounts failed: ${r.status}`);
  return r.json() as Promise<ThreadsAccount[]>;
}

export async function createAccount(input: CreateAccountInput): Promise<{ id: string }> {
  const r = await fetch(`${BASE}/api/v1/accounts`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!r.ok) throw await responseError(r, `create account failed: ${r.status}`);
  return r.json() as Promise<{ id: string }>;
}

export async function deleteAccount(id: string): Promise<void> {
  const r = await fetch(`${BASE}/api/v1/accounts/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!r.ok) throw await responseError(r, `delete account failed: ${r.status}`);
}

export async function getActiveAccount(): Promise<ThreadsAccount | null> {
  const r = await fetch(`${BASE}/api/v1/accounts/active`);
  if (!r.ok) throw await responseError(r, `get active account failed: ${r.status}`);
  return r.json() as Promise<ThreadsAccount | null>;
}

export async function setActiveAccount(id: string): Promise<void> {
  const r = await fetch(`${BASE}/api/v1/accounts/active`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id }),
  });
  if (r.status === 409) {
    const body = await r.json().catch(() => null) as { previewing_count?: unknown } | null;
    throw new PreviewingBlockError(typeof body?.previewing_count === "number" ? body.previewing_count : 1);
  }
  if (!r.ok) throw await responseError(r, `set active account failed: ${r.status}`);
}

export async function updateAccount(id: string, patch: Pick<ThreadsAccount, "persona" | "marketing_strategy" | "content_writing_rule">): Promise<void> {
  const r = await fetch(`${BASE}/api/v1/accounts/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!r.ok) throw await responseError(r, `update account failed: ${r.status}`);
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

export async function fetchScoutStatus(): Promise<{ running: boolean; accountMismatch?: AccountMismatch | null }> {
  const r = await fetch(`${BASE}/scout/status?tenant=${TENANT}`);
  if (!r.ok) throw new Error(`fetch scout status failed: ${r.status}`);
  return r.json() as Promise<{ running: boolean }>;
}

export async function fetchReviews(accountId: string): Promise<ReviewItem[]> {
  const r = await fetch(`${BASE}/reviews?tenant=${TENANT}&accountId=${encodeURIComponent(accountId)}`);
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
