import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchReviews, updateReview, type ReviewItem } from "./api";
import { AlertBar, Button, Card, MetricChip, StatusChip, TextArea } from "./components";
import { Check, Inbox, Lightbulb, RefreshCw, X } from "./icons";

interface ReviewQueueProps {
  onCountChange?: (count: number) => void;
}

function relativeAge(value: string): string {
  const then = new Date(value).getTime();
  if (!Number.isFinite(then)) return "";
  const diff = Date.now() - then;
  const minutes = Math.max(1, Math.floor(diff / 60_000));
  if (minutes < 60) return `${minutes} 分鐘前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}天前`;
}

function safeHandle(handle: string): string {
  return handle?.replace(/^@/, "") || "unknown";
}

function displayStatus(status: string): "pending" | "approved" | "sent" | "skipped" | "rejected" | "later" | "blocked" | "relevant" {
  if (["pending", "approved", "sent", "skipped", "rejected", "later", "blocked", "relevant"].includes(status)) {
    return status as "pending" | "approved" | "sent" | "skipped" | "rejected" | "later" | "blocked" | "relevant";
  }
  return "pending";
}

export default function ReviewQueue({ onCountChange }: ReviewQueueProps) {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [revCount, setRevCount] = useState(0);
  const [apprCount, setApprCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const fatigue = revCount >= 5 && apprCount / revCount >= 0.95;

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2200);
  }, []);

  const load = useCallback(async ({ showLoading = false }: { resetPosition?: boolean; showLoading?: boolean } = {}) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const data = await fetchReviews();
      setItems(data);
      setDrafts((prev) => {
        const next: Record<string, string> = {};
        for (const item of data) next[item.id] = prev[item.id] ?? item.draft ?? "";
        return next;
      });
      onCountChange?.(data.length);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [onCountChange]);

  useEffect(() => {
    void load({ resetPosition: true, showLoading: true });
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void load();
    }, 4000);
    return () => window.clearInterval(timer);
  }, [load]);

  const updateVisibleItem = useCallback((updatedId: string, patch: Partial<ReviewItem>) => {
    setItems((prev) => {
      const next = prev.map((item) => (item.id === updatedId ? { ...item, ...patch } : item));
      onCountChange?.(next.length);
      return next;
    });
  }, [onCountChange]);

  const approve = useCallback(async (item: ReviewItem) => {
    const draft = drafts[item.id] ?? item.draft ?? "";
    if (!draft.trim()) return;
    setBusy(true);
    try {
      await updateReview(item.id, { status: "approved", draft });
      setRevCount((n) => n + 1);
      setApprCount((n) => n + 1);
      showToast("已核准，排入發送");
      updateVisibleItem(item.id, { status: "approved", draft });
    } catch (e) {
      showToast(e instanceof Error ? e.message : "更新失敗");
    } finally {
      setBusy(false);
    }
  }, [drafts, showToast, updateVisibleItem]);

  const skip = useCallback(async (item: ReviewItem) => {
    const draft = drafts[item.id] ?? item.draft ?? "";
    setBusy(true);
    try {
      await updateReview(item.id, { status: "skipped", draft });
      setRevCount((n) => n + 1);
      showToast("跳過");
      updateVisibleItem(item.id, { status: "skipped", draft });
    } catch (e) {
      showToast(e instanceof Error ? e.message : "更新失敗");
    } finally {
      setBusy(false);
    }
  }, [drafts, showToast, updateVisibleItem]);

  const saveDraft = useCallback((item: ReviewItem) => {
    const draft = drafts[item.id] ?? "";
    if (draft === item.draft) return;
    void updateReview(item.id, { draft }).catch(() => {});
  }, [drafts]);

  const progress = useMemo(() => {
    return `${items.length} 筆`;
  }, [items.length]);

  if (loading) {
    return (
      <div className="grid flex-1 place-items-center gap-3 p-6 text-center text-[var(--text-muted)]">
        <RefreshCw width={28} height={28} />
        <p className="[font:var(--text-small)]">載入審核佇列...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="grid flex-1 place-items-center gap-3 p-6 text-center">
        <AlertBar tone="warning" title="後端尚未連線">{error}</AlertBar>
        <Button variant="secondary" icon={<RefreshCw />} onClick={() => void load({ resetPosition: true, showLoading: true })}>重新整理</Button>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="grid flex-1 place-items-center p-7 text-center">
        <div>
          <Inbox width={38} height={38} className="mx-auto mb-3 text-[var(--text-faint)]" />
          <h2 className="[font:var(--text-h2)] text-[var(--text-strong)]">沒有審核項目</h2>
          <p className="mt-2 max-w-[280px] [font:var(--text-small)] text-[var(--text-muted)]">跑完海巡後，符合條件的項目會出現在這裡。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between gap-4 p-4 pb-3">
        <div>
          <div className="font-[var(--font-mono)] text-[13px] leading-none text-[var(--text-strong)] [font-variant-numeric:tabular-nums]">{progress}</div>
          <div className="mt-1 font-[var(--font-mono)] text-[12px] leading-none text-[var(--text-muted)] [font-variant-numeric:tabular-nums]">已審 {revCount} · 通過 {apprCount}</div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" icon={<RefreshCw />} disabled={loading} onClick={() => void load({ resetPosition: true })}>重新整理</Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <div className="flex flex-col gap-3">
          {fatigue ? (
            <AlertBar tone="warning" title="審核節奏偏快">
              目前通過率偏高，送出前再確認語氣與關聯性。
            </AlertBar>
          ) : null}

          {items.map((item) => {
            const handle = safeHandle(item.post.author_handle);
            const draft = drafts[item.id] ?? item.draft ?? "";
            const draftEmpty = draft.trim().length === 0;
            const overLimit = draft.length > 60;

            return (
              <Card key={item.id} elevated className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <a className="block truncate [font:var(--fw-bold)_13.5px/1_var(--font-sans)] text-[var(--text-strong)] no-underline hover:underline" href={item.post.url} target="_blank" rel="noreferrer">@{handle}</a>
                    <span className="mt-1 block font-[var(--font-mono)] text-[12px] leading-none text-[var(--text-faint)]">{relativeAge(item.post.posted_at)}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-[6px]">
                    <StatusChip status={displayStatus(item.status)} />
                    <MetricChip kind="likes" value={item.post.likes ?? 0} />
                    <MetricChip kind="replies" value={item.post.replies ?? 0} />
                  </div>
                </div>

                <Card tone="inset" pad={16} className="whitespace-pre-wrap break-words [font:var(--fw-regular)_14.5px/var(--lh-body)_var(--font-sans)] text-[var(--text-body)]">
                  {item.post.text}
                </Card>

                <TextArea
                  label="回覆草稿"
                  maxHint={60}
                  rows={5}
                  value={draft}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                  onBlur={() => saveDraft(item)}
                  placeholder="輸入要送出的回覆..."
                />

                <div className="flex gap-[10px] rounded-[var(--radius-md)] border border-[var(--brand-soft-bd)] bg-[var(--brand-soft)] px-3 py-[10px] text-[var(--brand-700)]">
                  <Lightbulb width={17} height={17} className="mt-0.5 flex-none" />
                  <div>
                    <div className="mb-1 font-[var(--font-mono)] text-[11px] font-semibold leading-none tracking-[0.06em] text-[var(--brand-700)] uppercase">推薦理由</div>
                    <p className="[font:var(--fs-sm)/1.55_var(--font-sans)] text-[var(--brand-700)]">{item.reason || "符合目前海巡條件。"}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-[10px]">
                  <Button variant="ghost" icon={<X />} disabled={busy} onClick={() => void skip(item)}>跳過</Button>
                  <Button variant="primary" icon={<Check />} disabled={busy || draftEmpty} onClick={() => void approve(item)}>
                    核准
                  </Button>
                </div>
                {overLimit ? <div className="[font:var(--fs-xs)/1.5_var(--font-sans)] text-[var(--danger-text)]">草稿超過 60 字，送出前建議再收斂。</div> : null}
              </Card>
            );
          })}
        </div>
      </div>

      {toast ? <div className="pointer-events-none fixed bottom-7 left-1/2 -translate-x-1/2 rounded-[var(--radius-lg)] bg-[var(--ink-900)] px-5 py-[10px] text-white shadow-[var(--shadow-pop)] [font:var(--fw-medium)_13.5px/1_var(--font-sans)]">{toast}</div> : null}
    </div>
  );
}
