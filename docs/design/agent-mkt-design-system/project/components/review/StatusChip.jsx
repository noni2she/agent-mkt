import React from "react";

/**
 * Soft tinted status capsule — the review console's decision-state vocabulary.
 * Maps a ReviewStatus-like key to tone + dot + label. Never a saturated block.
 */
const MAP = {
  pending:  { tone: "warning", label: "待審" },
  approved: { tone: "success", label: "通過" },
  sent:     { tone: "success", label: "已送出" },
  rejected: { tone: "neutral", label: "跳過" },
  later:    { tone: "info",    label: "稍後再看" },
  blocked:  { tone: "danger",  label: "命中硬規則" },
  relevant: { tone: "brand",   label: "相關" },
};

const TONES = {
  neutral: { soft: "var(--surface-inset)", bd: "var(--border-default)", tx: "var(--text-muted)", dot: "var(--ink-400)" },
  brand:   { soft: "var(--brand-soft)", bd: "var(--brand-soft-bd)", tx: "var(--brand-700)", dot: "var(--brand)" },
  success: { soft: "var(--success-soft)", bd: "var(--success-bd)", tx: "var(--success-text)", dot: "var(--success)" },
  warning: { soft: "var(--warning-soft)", bd: "var(--warning-bd)", tx: "var(--warning-text)", dot: "var(--warning)" },
  danger:  { soft: "var(--danger-soft)", bd: "var(--danger-bd)", tx: "var(--danger-text)", dot: "var(--danger)" },
  info:    { soft: "var(--info-soft)", bd: "var(--info-bd)", tx: "var(--info-text)", dot: "var(--info)" },
};

export function StatusChip({ status = "pending", children, tone: toneProp, style, ...rest }) {
  const conf = MAP[status] || MAP.pending;
  const t = TONES[toneProp || conf.tone];
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "3px 10px 3px 8px",
        font: `var(--fw-bold) var(--fs-xs)/1.5 var(--font-sans)`,
        color: t.tx, background: t.soft,
        border: `1px solid ${t.bd}`,
        borderRadius: "var(--radius-pill)",
        whiteSpace: "nowrap",
        ...style,
      }}
      {...rest}
    >
      <span style={{ width: 7, height: 7, borderRadius: "var(--radius-pill)", background: t.dot, flex: "none" }} />
      {children ?? conf.label}
    </span>
  );
}
