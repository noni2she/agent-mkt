import React from "react";

/** Small, quiet label. `tone` tints it; `solid` fills for counts. */
export function Badge({ children, tone = "neutral", solid = false, style, ...rest }) {
  const tones = {
    neutral: { soft: "var(--surface-inset)", bd: "var(--border-default)", tx: "var(--text-muted)", solidBg: "var(--ink-700)" },
    brand:   { soft: "var(--brand-soft)", bd: "var(--brand-soft-bd)", tx: "var(--brand-700)", solidBg: "var(--brand)" },
    success: { soft: "var(--success-soft)", bd: "var(--success-bd)", tx: "var(--success-text)", solidBg: "var(--success)" },
    warning: { soft: "var(--warning-soft)", bd: "var(--warning-bd)", tx: "var(--warning-text)", solidBg: "var(--warning)" },
    danger:  { soft: "var(--danger-soft)", bd: "var(--danger-bd)", tx: "var(--danger-text)", solidBg: "var(--danger)" },
    info:    { soft: "var(--info-soft)", bd: "var(--info-bd)", tx: "var(--info-text)", solidBg: "var(--info)" },
  };
  const t = tones[tone] || tones.neutral;
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center",
        padding: "2px 8px",
        font: `var(--fw-medium) var(--fs-xs)/1.5 var(--font-sans)`,
        color: solid ? "#fff" : t.tx,
        background: solid ? t.solidBg : t.soft,
        border: `1px solid ${solid ? "transparent" : t.bd}`,
        borderRadius: "var(--radius-sm)",
        whiteSpace: "nowrap",
        ...style,
      }}
      {...rest}
    >
      {children}
    </span>
  );
}
