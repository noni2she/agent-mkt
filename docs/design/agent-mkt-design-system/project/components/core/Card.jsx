import React from "react";

/** Surface container. `pad` controls padding; `elevated` adds the card shadow; `tone` for inset wells. */
export function Card({ children, pad = 18, elevated = false, tone = "card", style, ...rest }) {
  const tones = {
    card: { bg: "var(--surface-card)", bd: "var(--border-subtle)" },
    sunken: { bg: "var(--surface-sunken)", bd: "var(--border-subtle)" },
    inset: { bg: "var(--surface-inset)", bd: "var(--border-subtle)" },
  };
  const t = tones[tone] || tones.card;
  return (
    <div
      style={{
        background: t.bg,
        border: `1px solid ${t.bd}`,
        borderRadius: "var(--radius-lg)",
        padding: typeof pad === "number" ? pad : pad,
        boxShadow: elevated ? "var(--shadow-card)" : "none",
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
