import React from "react";

/**
 * Draft editor textarea — the core surface where the reviewer rewrites the AI draft.
 * `empty` renders the dashed "stage-2 not yet generated" placeholder state.
 * Shows an optional character counter (drafts target ≤60 字).
 */
export function TextArea({
  value,
  onChange,
  placeholder,
  rows = 5,
  empty = false,
  maxHint,
  label,
  disabled = false,
  style,
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  const len = (value || "").length;
  const over = maxHint != null && len > maxHint;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, ...style }}>
      {label && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ font: `var(--fw-medium) var(--fs-sm)/1.3 var(--font-sans)`, color: "var(--text-strong)" }}>{label}</span>
          {maxHint != null && (
            <span style={{ font: `var(--fs-xs)/1 var(--font-mono)`, color: over ? "var(--danger-text)" : "var(--text-faint)", fontVariantNumeric: "tabular-nums" }}>
              {len} / {maxHint}
            </span>
          )}
        </div>
      )}
      <textarea
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={onChange}
        disabled={disabled}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={{
          width: "100%", resize: "vertical",
          font: `var(--fw-regular) var(--fs-body)/var(--lh-relaxed) var(--font-sans)`,
          color: empty ? "var(--text-faint)" : "var(--text-strong)",
          background: empty ? "var(--surface-sunken)" : "var(--surface-card)",
          border: `${empty ? "1.5px dashed var(--border-strong)" : `1px solid ${focus ? "var(--brand-500)" : "var(--border-default)"}`}`,
          borderRadius: "var(--radius-md)",
          padding: "12px 14px",
          outline: "none",
          boxShadow: focus && !empty ? "var(--shadow-focus)" : "none",
          boxSizing: "border-box",
          transition: "border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)",
        }}
        {...rest}
      />
    </div>
  );
}
