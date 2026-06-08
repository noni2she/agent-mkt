import React from "react";

/** Labeled text input wrapper. Renders label, optional hint, and a single-line input. */
export function Field({ label, hint, value, onChange, placeholder, type = "text", invalid = false, mono = false, style, ...rest }) {
  const [focus, setFocus] = React.useState(false);
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, ...style }}>
      {label && (
        <span style={{ font: `var(--fw-medium) var(--fs-sm)/1.3 var(--font-sans)`, color: "var(--text-strong)" }}>{label}</span>
      )}
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={onChange}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={{
          font: `var(--fw-regular) var(--fs-body)/1.4 ${mono ? "var(--font-mono)" : "var(--font-sans)"}`,
          color: "var(--text-strong)",
          background: "var(--surface-card)",
          border: `1px solid ${invalid ? "var(--danger)" : focus ? "var(--brand-500)" : "var(--border-default)"}`,
          borderRadius: "var(--radius-md)",
          padding: "9px 12px",
          outline: "none",
          boxShadow: focus ? "var(--shadow-focus)" : "none",
          transition: "border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)",
        }}
        {...rest}
      />
      {hint && (
        <span style={{ font: `var(--fs-xs)/1.4 var(--font-sans)`, color: invalid ? "var(--danger-text)" : "var(--text-muted)" }}>{hint}</span>
      )}
    </label>
  );
}
