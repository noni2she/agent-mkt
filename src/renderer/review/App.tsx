import type React from "react";
import { useEffect, useMemo, useState } from "react";
import type { ReviewItem } from "../../shared/types.js";
import type { AgentMktApi } from "../../main/preload.js";

declare global {
  interface Window {
    agentMkt: AgentMktApi;
  }
}

const APPROVAL_WARN = 0.95;

export function App(): React.JSX.Element {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [idx, setIdx] = useState(0);
  const [edited, setEdited] = useState("");
  const [busy, setBusy] = useState(false);
  const [reviewedCount, setReviewed] = useState(0);
  const [approvedCount, setApproved] = useState(0);

  const refresh = async (): Promise<void> => {
    const p = await window.agentMkt.pending();
    setItems(p);
    setIdx(0);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const current = items[idx];
  useEffect(() => {
    setEdited(current ? (current.edited_draft ?? current.draft) : "");
  }, [current]);

  const isEmptyDraft =
    !!current && (current.edited_draft ?? current.draft).trim() === "";

  const approvalRate = reviewedCount ? approvedCount / reviewedCount : 0;
  const fatigueWarn = useMemo(
    () => reviewedCount >= 5 && approvalRate >= APPROVAL_WARN,
    [reviewedCount, approvalRate],
  );

  const next = (): void => setIdx((i) => Math.min(i + 1, items.length - 1));

  const onApprove = async (): Promise<void> => {
    if (!current || busy) return;
    if (current.rule_flags.length) {
      alert(`此草稿命中硬規則，不可送出：\n${current.rule_flags.join("\n")}`);
      return;
    }
    setBusy(true);
    const changed = edited.trim() !== current.draft.trim();
    const res = await window.agentMkt.approve(current.id, changed ? edited.trim() : undefined);
    setBusy(false);
    setReviewed((c) => c + 1);
    setApproved((c) => c + 1);
    if (!res.ok) alert(`送出失敗：${res.error ?? res.signals?.join(",")}`);
    await refresh();
  };

  const onReject = async (): Promise<void> => {
    if (!current || busy) return;
    setBusy(true);
    await window.agentMkt.reject(current.id);
    setBusy(false);
    setReviewed((c) => c + 1);
    await refresh();
  };

  const onScout = async (): Promise<void> => {
    setBusy(true);
    const stats = await window.agentMkt.runScout();
    setBusy(false);
    alert(
      `海巡完成\n瀏覽：${stats.posts_viewed}\n偵測訊號：${
        stats.detection_signals.join(",") || "無"
      }`,
    );
    await refresh();
  };

  return (
    <div style={S.wrap}>
      <header style={S.head}>
        <strong>agent-mkt 小編審核台</strong>
        <span>
          待審 {items.length}｜本批已審 {reviewedCount}｜通過率{" "}
          {(approvalRate * 100).toFixed(0)}%
        </span>
        <button onClick={onScout} disabled={busy}>
          {busy ? "處理中…" : "▶ 執行海巡"}
        </button>
      </header>

      {fatigueWarn && (
        <div style={S.warn}>
          ⚠️ 通過率 ≥ {APPROVAL_WARN * 100}%，可能審核疲勞 — 請確認你有逐條讀過原文
        </div>
      )}

      {!current && <div style={S.empty}>目前沒有待審項目。先執行海巡。</div>}

      {current && (
        <div style={S.card}>
          <div style={S.meta}>
            <span>第 {idx + 1} / {items.length} 筆</span>
            <span style={S.reason}>推薦理由：{current.recommend_reason}</span>
          </div>

          {current.target_post && (
            <div style={S.original}>
              <div style={S.label}>原文（必讀上下文）</div>
              <div>
                <a href={current.target_post.url} target="_blank" rel="noreferrer">
                  @{current.target_post.author_handle}
                </a>
                ：{current.target_post.text}
              </div>
              {current.target_post.thread_excerpt.length > 0 && (
                <div style={S.excerpt}>
                  留言串氣氛：{current.target_post.thread_excerpt.join(" ｜ ")}
                </div>
              )}
            </div>
          )}

          {current.rule_flags.length > 0 && (
            <div style={S.warn}>硬規則命中（不可送出）：{current.rule_flags.join("、")}</div>
          )}

          <div style={S.label}>
            {isEmptyDraft ? "AI 回應草稿（階段二尚未產生）" : "AI 草稿（可直接改寫）"}
          </div>
          <textarea
            style={{ ...S.editor, ...(isEmptyDraft ? S.editorEmpty : {}) }}
            value={edited}
            onChange={(e) => setEdited(e.target.value)}
            placeholder={
              isEmptyDraft
                ? "目前僅海巡（階段一）。階段二將由 AI 為這篇貼文產生回應草稿。"
                : ""
            }
            rows={5}
          />

          <div style={S.actions}>
            <button onClick={onReject} disabled={busy} style={S.reject}>
              ✕ 跳過
            </button>
            <button onClick={next} disabled={busy}>
              ↓ 稍後再看
            </button>
            <button
              onClick={onApprove}
              disabled={busy || current.rule_flags.length > 0 || isEmptyDraft}
              style={S.approve}
              title={isEmptyDraft ? "階段二尚未實作，無回應內容可送出" : ""}
            >
              ✓ 通過並送出
            </button>
          </div>
          <small style={S.hint}>
            {isEmptyDraft
              ? "階段一：僅驗證海巡。確認熱門貼文有正確依關鍵字撈回即可；回應為階段二。"
              : "無「全部通過」鍵：每一筆都必須逐條決定。送出動作由你觸發，AI 不自動送。"}
          </small>
        </div>
      )}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  wrap: { fontFamily: "system-ui, -apple-system, sans-serif", padding: 20, maxWidth: 820, margin: "0 auto" },
  head: { display: "flex", gap: 16, alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  warn: { background: "#fff3cd", border: "1px solid #ffe69c", padding: 10, borderRadius: 6, margin: "8px 0", fontSize: 14 },
  empty: { color: "#666", padding: 40, textAlign: "center" },
  card: { border: "1px solid #ddd", borderRadius: 10, padding: 18 },
  meta: { display: "flex", justifyContent: "space-between", color: "#666", fontSize: 13, marginBottom: 12 },
  reason: { color: "#0a7" },
  original: { background: "#f7f7f8", padding: 12, borderRadius: 8, marginBottom: 14, lineHeight: 1.6 },
  excerpt: { color: "#888", fontSize: 13, marginTop: 6 },
  label: { fontWeight: 600, fontSize: 13, margin: "8px 0 6px" },
  editor: { width: "100%", fontSize: 15, padding: 10, borderRadius: 6, border: "1px solid #ccc", boxSizing: "border-box" },
  editorEmpty: { borderStyle: "dashed", background: "#fafafa", color: "#999" },
  actions: { display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" },
  approve: { background: "#0a7", color: "#fff", border: 0, padding: "8px 16px", borderRadius: 6, cursor: "pointer" },
  reject: { background: "#eee", border: 0, padding: "8px 16px", borderRadius: 6, cursor: "pointer" },
  hint: { display: "block", color: "#999", marginTop: 10 },
};
