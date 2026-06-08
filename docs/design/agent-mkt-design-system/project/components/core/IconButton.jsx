import React from "react";

/** Square icon-only button. Use for toolbar / row actions. */
export function IconButton({
  icon,
  label,
  variant = "ghost",
  size = "md",
  disabled = false,
  onClick,
  style,
  ...rest
}) {
  const sizes = { sm: 28, md: 34, lg: 40 };
  const dim = sizes[size] || sizes.md;
  const palettes = {
    ghost: { bg: "transparent", color: "var(--text-muted)", border: "transparent", hbg: "var(--surface-inset)", hcolor: "var(--text-strong)" },
    solid: { bg: "var(--surface-card)", color: "var(--text-body)", border: "var(--border-default)", hbg: "var(--surface-inset)", hcolor: "var(--text-strong)" },
    danger: { bg: "transparent", color: "var(--danger)", border: "transparent", hbg: "var(--danger-soft)", hcolor: "var(--danger-text)" },
  };
  const p = palettes[variant] || palettes.ghost;
  const [hover, setHover] = React.useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-grid", placeItems: "center",
        width: dim, height: dim,
        color: hover && !disabled ? p.hcolor : p.color,
        background: hover && !disabled ? p.hbg : p.bg,
        border: `1px solid ${p.border}`,
        borderRadius: "var(--radius-md)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        transition: "background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out)",
        ...style,
      }}
      {...rest}
    >
      <span style={{ display: "inline-flex", width: Math.round(dim * 0.5), height: Math.round(dim * 0.5) }}>{icon}</span>
    </button>
  );
}
