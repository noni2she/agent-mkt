import React from "react";

/** Handle avatar — initial monogram (default) or image. Threads handles map to a stable tint. */
export function Avatar({ handle = "", src, size = 36, style, ...rest }) {
  const clean = handle.replace(/^@/, "");
  const initial = clean ? clean[0].toUpperCase() : "?";
  // stable hue from handle
  let h = 0;
  for (let i = 0; i < clean.length; i++) h = (h * 31 + clean.charCodeAt(i)) % 360;
  const bg = `oklch(0.92 0.05 ${h})`;
  const fg = `oklch(0.45 0.09 ${h})`;
  return (
    <span
      title={handle ? "@" + clean : undefined}
      style={{
        display: "inline-grid", placeItems: "center", flex: "none",
        width: size, height: size, borderRadius: "var(--radius-pill)",
        overflow: "hidden",
        background: src ? "var(--surface-inset)" : bg,
        color: fg,
        border: "1px solid var(--border-subtle)",
        font: `var(--fw-bold) ${Math.round(size * 0.42)}px/1 var(--font-sans)`,
        ...style,
      }}
      {...rest}
    >
      {src ? <img src={src} alt={clean} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initial}
    </span>
  );
}
