import React from "react";

/**
 * Threads engagement metric chip — likes / replies / age / followers.
 * Likes keep the native 👍 (or a coral heart); the value uses tabular mono figures.
 */
const KINDS = {
  likes:     { glyph: "👍", color: "var(--coral-600)" },
  replies:   { glyph: "💬", color: "var(--text-muted)" },
  age:       { glyph: null, lucide: "clock", color: "var(--text-muted)" },
  followers: { glyph: null, lucide: "users", color: "var(--text-muted)" },
};

export function MetricChip({ kind = "likes", value, glyph, style, ...rest }) {
  const k = KINDS[kind] || KINDS.likes;
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "3px 9px",
        font: `var(--fw-medium) var(--fs-mono)/1 var(--font-mono)`,
        color: "var(--text-body)",
        background: "var(--surface-inset)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-pill)",
        fontVariantNumeric: "tabular-nums",
        whiteSpace: "nowrap",
        ...style,
      }}
      {...rest}
    >
      <span style={{ fontSize: 12, lineHeight: 1, color: k.color, display: "inline-flex" }}>
        {glyph ?? (k.glyph || (k.lucide ? <i data-lucide={k.lucide} style={{ width: 13, height: 13 }} /> : null))}
      </span>
      {value}
    </span>
  );
}
