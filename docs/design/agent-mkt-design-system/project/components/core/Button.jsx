import React from "react";

/**
 * agent-mkt primary action control.
 * Variants carry meaning in this product: `primary` (brand teal) is the
 * approve/go action, `danger` is destructive, `secondary`/`ghost` are neutral.
 */
export function Button({
  children,
  variant = "secondary",
  size = "md",
  icon,
  iconRight,
  disabled = false,
  full = false,
  type = "button",
  onClick,
  style,
  ...rest
}) {
  const sizes = {
    sm: { h: 30, px: 10, fs: 13, gap: 6, ic: 15 },
    md: { h: 38, px: 15, fs: 14, gap: 7, ic: 17 },
    lg: { h: 46, px: 20, fs: 15.5, gap: 8, ic: 19 },
  };
  const s = sizes[size] || sizes.md;

  const palettes = {
    primary: {
      bg: "var(--brand)", color: "var(--on-brand)", border: "var(--brand)",
      hbg: "var(--brand-hover)", hborder: "var(--brand-hover)",
    },
    secondary: {
      bg: "var(--surface-card)", color: "var(--text-strong)", border: "var(--border-default)",
      hbg: "var(--surface-inset)", hborder: "var(--border-strong)",
    },
    ghost: {
      bg: "transparent", color: "var(--text-body)", border: "transparent",
      hbg: "var(--surface-inset)", hborder: "transparent",
    },
    danger: {
      bg: "var(--surface-card)", color: "var(--danger-text)", border: "var(--danger-bd)",
      hbg: "var(--danger-soft)", hborder: "var(--danger)",
    },
  };
  const p = palettes[variant] || palettes.secondary;
  const [hover, setHover] = React.useState(false);

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        gap: s.gap, height: s.h, padding: `0 ${s.px}px`,
        width: full ? "100%" : "auto",
        font: `var(--fw-medium) ${s.fs}px/1 var(--font-sans)`,
        color: p.color,
        background: hover && !disabled ? p.hbg : p.bg,
        border: `1px solid ${hover && !disabled ? p.hborder : p.border}`,
        borderRadius: "var(--radius-md)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        transition: "background var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out)",
        whiteSpace: "nowrap",
        ...style,
      }}
      {...rest}
    >
      {icon && <span style={{ display: "inline-flex", width: s.ic, height: s.ic }}>{icon}</span>}
      {children}
      {iconRight && <span style={{ display: "inline-flex", width: s.ic, height: s.ic }}>{iconRight}</span>}
    </button>
  );
}
