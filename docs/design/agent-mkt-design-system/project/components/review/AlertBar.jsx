import React from "react";

/**
 * Full-width alert block — the safety voice of the console.
 * `danger` for hard-rule violations (un-sendable), `warning` for review-fatigue
 * and caution, `info` for neutral notes. Soft tinted capsule, icon + message.
 */
const TONES = {
  danger:  { soft: "var(--danger-soft)",  bd: "var(--danger-bd)",  tx: "var(--danger-text)",  ic: "var(--danger)",  lucide: "shield-alert" },
  warning: { soft: "var(--warning-soft)", bd: "var(--warning-bd)", tx: "var(--warning-text)", ic: "var(--warning)", lucide: "triangle-alert" },
  info:    { soft: "var(--info-soft)",    bd: "var(--info-bd)",    tx: "var(--info-text)",    ic: "var(--info)",    lucide: "info" },
  success: { soft: "var(--success-soft)", bd: "var(--success-bd)", tx: "var(--success-text)", ic: "var(--success)", lucide: "shield-check" },
};

export function AlertBar({ tone = "warning", title, children, icon, style, ...rest }) {
  const t = TONES[tone] || TONES.warning;
  return (
    <div
      role="alert"
      style={{
        display: "flex", gap: 11, alignItems: "flex-start",
        padding: "12px 14px",
        background: t.soft,
        border: `1px solid ${t.bd}`,
        borderRadius: "var(--radius-lg)",
        ...style,
      }}
      {...rest}
    >
      <span style={{ display: "inline-flex", width: 18, height: 18, color: t.ic, flex: "none", marginTop: 1 }}>
        {icon ?? <i data-lucide={t.lucide} style={{ width: 18, height: 18 }} />}
      </span>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        {title && <div style={{ font: `var(--fw-bold) var(--fs-sm)/1.4 var(--font-sans)`, color: t.tx }}>{title}</div>}
        {children && <div style={{ font: `var(--fs-sm)/1.55 var(--font-sans)`, color: t.tx, opacity: 0.92 }}>{children}</div>}
      </div>
    </div>
  );
}
