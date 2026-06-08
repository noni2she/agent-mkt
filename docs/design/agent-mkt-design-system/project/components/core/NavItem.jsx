import React from "react";

/** Sidebar navigation row. Pass `icon` (e.g. a Lucide <i>), `label`, `active`, optional `count`. */
export function NavItem({ icon, label, active = false, count, onClick, style, ...rest }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", alignItems: "center", gap: 11, width: "100%",
        padding: "9px 11px", textAlign: "left",
        font: `var(--fw-medium) var(--fs-sm)/1 var(--font-sans)`,
        color: active ? "var(--brand-700)" : "var(--text-body)",
        background: active ? "var(--brand-soft)" : hover ? "var(--surface-inset)" : "transparent",
        border: "1px solid " + (active ? "var(--brand-soft-bd)" : "transparent"),
        borderRadius: "var(--radius-md)",
        cursor: "pointer",
        transition: "background var(--dur-fast) var(--ease-out)",
        ...style,
      }}
      {...rest}
    >
      <span style={{ display: "inline-flex", width: 18, height: 18, color: active ? "var(--brand-600)" : "var(--text-muted)" }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {count != null && (
        <span style={{
          font: `var(--fw-bold) var(--fs-xs)/1 var(--font-mono)`,
          color: active ? "var(--brand-700)" : "var(--text-muted)",
          background: active ? "var(--surface-card)" : "var(--surface-inset)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-pill)", padding: "3px 7px",
          fontVariantNumeric: "tabular-nums",
        }}>{count}</span>
      )}
    </button>
  );
}
