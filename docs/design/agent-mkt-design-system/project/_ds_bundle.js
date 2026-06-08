/* @ds-bundle: {"format":3,"namespace":"AgentMktDesignSystem_ec4390","components":[{"name":"Avatar","sourcePath":"components/core/Avatar.jsx"},{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"IconButton","sourcePath":"components/core/IconButton.jsx"},{"name":"NavItem","sourcePath":"components/core/NavItem.jsx"},{"name":"Field","sourcePath":"components/forms/Field.jsx"},{"name":"TextArea","sourcePath":"components/forms/TextArea.jsx"},{"name":"AlertBar","sourcePath":"components/review/AlertBar.jsx"},{"name":"MetricChip","sourcePath":"components/review/MetricChip.jsx"},{"name":"StatusChip","sourcePath":"components/review/StatusChip.jsx"}],"sourceHashes":{"components/core/Avatar.jsx":"594ed8749840","components/core/Badge.jsx":"ae33c6c29c02","components/core/Button.jsx":"95161d3fd006","components/core/Card.jsx":"605ecf989a8a","components/core/IconButton.jsx":"ece5c20d0ce1","components/core/NavItem.jsx":"52bbc3bfef1a","components/forms/Field.jsx":"393ee033415d","components/forms/TextArea.jsx":"8c43e48c5dce","components/review/AlertBar.jsx":"49dbb90f8701","components/review/MetricChip.jsx":"cb0b66d25353","components/review/StatusChip.jsx":"3d5c94aace74"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.AgentMktDesignSystem_ec4390 = window.AgentMktDesignSystem_ec4390 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Avatar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Handle avatar — initial monogram (default) or image. Threads handles map to a stable tint. */
function Avatar({
  handle = "",
  src,
  size = 36,
  style,
  ...rest
}) {
  const clean = handle.replace(/^@/, "");
  const initial = clean ? clean[0].toUpperCase() : "?";
  // stable hue from handle
  let h = 0;
  for (let i = 0; i < clean.length; i++) h = (h * 31 + clean.charCodeAt(i)) % 360;
  const bg = `oklch(0.92 0.05 ${h})`;
  const fg = `oklch(0.45 0.09 ${h})`;
  return /*#__PURE__*/React.createElement("span", _extends({
    title: handle ? "@" + clean : undefined,
    style: {
      display: "inline-grid",
      placeItems: "center",
      flex: "none",
      width: size,
      height: size,
      borderRadius: "var(--radius-pill)",
      overflow: "hidden",
      background: src ? "var(--surface-inset)" : bg,
      color: fg,
      border: "1px solid var(--border-subtle)",
      font: `var(--fw-bold) ${Math.round(size * 0.42)}px/1 var(--font-sans)`,
      ...style
    }
  }, rest), src ? /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: clean,
    style: {
      width: "100%",
      height: "100%",
      objectFit: "cover"
    }
  }) : initial);
}
Object.assign(__ds_scope, { Avatar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Avatar.jsx", error: String((e && e.message) || e) }); }

// components/core/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Small, quiet label. `tone` tints it; `solid` fills for counts. */
function Badge({
  children,
  tone = "neutral",
  solid = false,
  style,
  ...rest
}) {
  const tones = {
    neutral: {
      soft: "var(--surface-inset)",
      bd: "var(--border-default)",
      tx: "var(--text-muted)",
      solidBg: "var(--ink-700)"
    },
    brand: {
      soft: "var(--brand-soft)",
      bd: "var(--brand-soft-bd)",
      tx: "var(--brand-700)",
      solidBg: "var(--brand)"
    },
    success: {
      soft: "var(--success-soft)",
      bd: "var(--success-bd)",
      tx: "var(--success-text)",
      solidBg: "var(--success)"
    },
    warning: {
      soft: "var(--warning-soft)",
      bd: "var(--warning-bd)",
      tx: "var(--warning-text)",
      solidBg: "var(--warning)"
    },
    danger: {
      soft: "var(--danger-soft)",
      bd: "var(--danger-bd)",
      tx: "var(--danger-text)",
      solidBg: "var(--danger)"
    },
    info: {
      soft: "var(--info-soft)",
      bd: "var(--info-bd)",
      tx: "var(--info-text)",
      solidBg: "var(--info)"
    }
  };
  const t = tones[tone] || tones.neutral;
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: "inline-flex",
      alignItems: "center",
      padding: "2px 8px",
      font: `var(--fw-medium) var(--fs-xs)/1.5 var(--font-sans)`,
      color: solid ? "#fff" : t.tx,
      background: solid ? t.solidBg : t.soft,
      border: `1px solid ${solid ? "transparent" : t.bd}`,
      borderRadius: "var(--radius-sm)",
      whiteSpace: "nowrap",
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * agent-mkt primary action control.
 * Variants carry meaning in this product: `primary` (brand teal) is the
 * approve/go action, `danger` is destructive, `secondary`/`ghost` are neutral.
 */
function Button({
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
    sm: {
      h: 30,
      px: 10,
      fs: 13,
      gap: 6,
      ic: 15
    },
    md: {
      h: 38,
      px: 15,
      fs: 14,
      gap: 7,
      ic: 17
    },
    lg: {
      h: 46,
      px: 20,
      fs: 15.5,
      gap: 8,
      ic: 19
    }
  };
  const s = sizes[size] || sizes.md;
  const palettes = {
    primary: {
      bg: "var(--brand)",
      color: "var(--on-brand)",
      border: "var(--brand)",
      hbg: "var(--brand-hover)",
      hborder: "var(--brand-hover)"
    },
    secondary: {
      bg: "var(--surface-card)",
      color: "var(--text-strong)",
      border: "var(--border-default)",
      hbg: "var(--surface-inset)",
      hborder: "var(--border-strong)"
    },
    ghost: {
      bg: "transparent",
      color: "var(--text-body)",
      border: "transparent",
      hbg: "var(--surface-inset)",
      hborder: "transparent"
    },
    danger: {
      bg: "var(--surface-card)",
      color: "var(--danger-text)",
      border: "var(--danger-bd)",
      hbg: "var(--danger-soft)",
      hborder: "var(--danger)"
    }
  };
  const p = palettes[variant] || palettes.secondary;
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("button", _extends({
    type: type,
    disabled: disabled,
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: s.gap,
      height: s.h,
      padding: `0 ${s.px}px`,
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
      ...style
    }
  }, rest), icon && /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      width: s.ic,
      height: s.ic
    }
  }, icon), children, iconRight && /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      width: s.ic,
      height: s.ic
    }
  }, iconRight));
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Surface container. `pad` controls padding; `elevated` adds the card shadow; `tone` for inset wells. */
function Card({
  children,
  pad = 18,
  elevated = false,
  tone = "card",
  style,
  ...rest
}) {
  const tones = {
    card: {
      bg: "var(--surface-card)",
      bd: "var(--border-subtle)"
    },
    sunken: {
      bg: "var(--surface-sunken)",
      bd: "var(--border-subtle)"
    },
    inset: {
      bg: "var(--surface-inset)",
      bd: "var(--border-subtle)"
    }
  };
  const t = tones[tone] || tones.card;
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      background: t.bg,
      border: `1px solid ${t.bd}`,
      borderRadius: "var(--radius-lg)",
      padding: typeof pad === "number" ? pad : pad,
      boxShadow: elevated ? "var(--shadow-card)" : "none",
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/IconButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Square icon-only button. Use for toolbar / row actions. */
function IconButton({
  icon,
  label,
  variant = "ghost",
  size = "md",
  disabled = false,
  onClick,
  style,
  ...rest
}) {
  const sizes = {
    sm: 28,
    md: 34,
    lg: 40
  };
  const dim = sizes[size] || sizes.md;
  const palettes = {
    ghost: {
      bg: "transparent",
      color: "var(--text-muted)",
      border: "transparent",
      hbg: "var(--surface-inset)",
      hcolor: "var(--text-strong)"
    },
    solid: {
      bg: "var(--surface-card)",
      color: "var(--text-body)",
      border: "var(--border-default)",
      hbg: "var(--surface-inset)",
      hcolor: "var(--text-strong)"
    },
    danger: {
      bg: "transparent",
      color: "var(--danger)",
      border: "transparent",
      hbg: "var(--danger-soft)",
      hcolor: "var(--danger-text)"
    }
  };
  const p = palettes[variant] || palettes.ghost;
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    "aria-label": label,
    title: label,
    disabled: disabled,
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: "inline-grid",
      placeItems: "center",
      width: dim,
      height: dim,
      color: hover && !disabled ? p.hcolor : p.color,
      background: hover && !disabled ? p.hbg : p.bg,
      border: `1px solid ${p.border}`,
      borderRadius: "var(--radius-md)",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.4 : 1,
      transition: "background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out)",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      width: Math.round(dim * 0.5),
      height: Math.round(dim * 0.5)
    }
  }, icon));
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/core/NavItem.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Sidebar navigation row. Pass `icon` (e.g. a Lucide <i>), `label`, `active`, optional `count`. */
function NavItem({
  icon,
  label,
  active = false,
  count,
  onClick,
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: "flex",
      alignItems: "center",
      gap: 11,
      width: "100%",
      padding: "9px 11px",
      textAlign: "left",
      font: `var(--fw-medium) var(--fs-sm)/1 var(--font-sans)`,
      color: active ? "var(--brand-700)" : "var(--text-body)",
      background: active ? "var(--brand-soft)" : hover ? "var(--surface-inset)" : "transparent",
      border: "1px solid " + (active ? "var(--brand-soft-bd)" : "transparent"),
      borderRadius: "var(--radius-md)",
      cursor: "pointer",
      transition: "background var(--dur-fast) var(--ease-out)",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      width: 18,
      height: 18,
      color: active ? "var(--brand-600)" : "var(--text-muted)"
    }
  }, icon), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }, label), count != null && /*#__PURE__*/React.createElement("span", {
    style: {
      font: `var(--fw-bold) var(--fs-xs)/1 var(--font-mono)`,
      color: active ? "var(--brand-700)" : "var(--text-muted)",
      background: active ? "var(--surface-card)" : "var(--surface-inset)",
      border: "1px solid var(--border-subtle)",
      borderRadius: "var(--radius-pill)",
      padding: "3px 7px",
      fontVariantNumeric: "tabular-nums"
    }
  }, count));
}
Object.assign(__ds_scope, { NavItem });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/NavItem.jsx", error: String((e && e.message) || e) }); }

// components/forms/Field.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Labeled text input wrapper. Renders label, optional hint, and a single-line input. */
function Field({
  label,
  hint,
  value,
  onChange,
  placeholder,
  type = "text",
  invalid = false,
  mono = false,
  style,
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6,
      ...style
    }
  }, label && /*#__PURE__*/React.createElement("span", {
    style: {
      font: `var(--fw-medium) var(--fs-sm)/1.3 var(--font-sans)`,
      color: "var(--text-strong)"
    }
  }, label), /*#__PURE__*/React.createElement("input", _extends({
    type: type,
    value: value,
    placeholder: placeholder,
    onChange: onChange,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      font: `var(--fw-regular) var(--fs-body)/1.4 ${mono ? "var(--font-mono)" : "var(--font-sans)"}`,
      color: "var(--text-strong)",
      background: "var(--surface-card)",
      border: `1px solid ${invalid ? "var(--danger)" : focus ? "var(--brand-500)" : "var(--border-default)"}`,
      borderRadius: "var(--radius-md)",
      padding: "9px 12px",
      outline: "none",
      boxShadow: focus ? "var(--shadow-focus)" : "none",
      transition: "border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)"
    }
  }, rest)), hint && /*#__PURE__*/React.createElement("span", {
    style: {
      font: `var(--fs-xs)/1.4 var(--font-sans)`,
      color: invalid ? "var(--danger-text)" : "var(--text-muted)"
    }
  }, hint));
}
Object.assign(__ds_scope, { Field });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Field.jsx", error: String((e && e.message) || e) }); }

// components/forms/TextArea.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Draft editor textarea — the core surface where the reviewer rewrites the AI draft.
 * `empty` renders the dashed "stage-2 not yet generated" placeholder state.
 * Shows an optional character counter (drafts target ≤60 字).
 */
function TextArea({
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
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6,
      ...style
    }
  }, label && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "baseline"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: `var(--fw-medium) var(--fs-sm)/1.3 var(--font-sans)`,
      color: "var(--text-strong)"
    }
  }, label), maxHint != null && /*#__PURE__*/React.createElement("span", {
    style: {
      font: `var(--fs-xs)/1 var(--font-mono)`,
      color: over ? "var(--danger-text)" : "var(--text-faint)",
      fontVariantNumeric: "tabular-nums"
    }
  }, len, " / ", maxHint)), /*#__PURE__*/React.createElement("textarea", _extends({
    value: value,
    rows: rows,
    placeholder: placeholder,
    onChange: onChange,
    disabled: disabled,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      width: "100%",
      resize: "vertical",
      font: `var(--fw-regular) var(--fs-body)/var(--lh-relaxed) var(--font-sans)`,
      color: empty ? "var(--text-faint)" : "var(--text-strong)",
      background: empty ? "var(--surface-sunken)" : "var(--surface-card)",
      border: `${empty ? "1.5px dashed var(--border-strong)" : `1px solid ${focus ? "var(--brand-500)" : "var(--border-default)"}`}`,
      borderRadius: "var(--radius-md)",
      padding: "12px 14px",
      outline: "none",
      boxShadow: focus && !empty ? "var(--shadow-focus)" : "none",
      boxSizing: "border-box",
      transition: "border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)"
    }
  }, rest)));
}
Object.assign(__ds_scope, { TextArea });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/TextArea.jsx", error: String((e && e.message) || e) }); }

// components/review/AlertBar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Full-width alert block — the safety voice of the console.
 * `danger` for hard-rule violations (un-sendable), `warning` for review-fatigue
 * and caution, `info` for neutral notes. Soft tinted capsule, icon + message.
 */
const TONES = {
  danger: {
    soft: "var(--danger-soft)",
    bd: "var(--danger-bd)",
    tx: "var(--danger-text)",
    ic: "var(--danger)",
    lucide: "shield-alert"
  },
  warning: {
    soft: "var(--warning-soft)",
    bd: "var(--warning-bd)",
    tx: "var(--warning-text)",
    ic: "var(--warning)",
    lucide: "triangle-alert"
  },
  info: {
    soft: "var(--info-soft)",
    bd: "var(--info-bd)",
    tx: "var(--info-text)",
    ic: "var(--info)",
    lucide: "info"
  },
  success: {
    soft: "var(--success-soft)",
    bd: "var(--success-bd)",
    tx: "var(--success-text)",
    ic: "var(--success)",
    lucide: "shield-check"
  }
};
function AlertBar({
  tone = "warning",
  title,
  children,
  icon,
  style,
  ...rest
}) {
  const t = TONES[tone] || TONES.warning;
  return /*#__PURE__*/React.createElement("div", _extends({
    role: "alert",
    style: {
      display: "flex",
      gap: 11,
      alignItems: "flex-start",
      padding: "12px 14px",
      background: t.soft,
      border: `1px solid ${t.bd}`,
      borderRadius: "var(--radius-lg)",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      width: 18,
      height: 18,
      color: t.ic,
      flex: "none",
      marginTop: 1
    }
  }, icon ?? /*#__PURE__*/React.createElement("i", {
    "data-lucide": t.lucide,
    style: {
      width: 18,
      height: 18
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 2,
      minWidth: 0
    }
  }, title && /*#__PURE__*/React.createElement("div", {
    style: {
      font: `var(--fw-bold) var(--fs-sm)/1.4 var(--font-sans)`,
      color: t.tx
    }
  }, title), children && /*#__PURE__*/React.createElement("div", {
    style: {
      font: `var(--fs-sm)/1.55 var(--font-sans)`,
      color: t.tx,
      opacity: 0.92
    }
  }, children)));
}
Object.assign(__ds_scope, { AlertBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/review/AlertBar.jsx", error: String((e && e.message) || e) }); }

// components/review/MetricChip.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Threads engagement metric chip — likes / replies / age / followers.
 * Likes keep the native 👍 (or a coral heart); the value uses tabular mono figures.
 */
const KINDS = {
  likes: {
    glyph: "👍",
    color: "var(--coral-600)"
  },
  replies: {
    glyph: "💬",
    color: "var(--text-muted)"
  },
  age: {
    glyph: null,
    lucide: "clock",
    color: "var(--text-muted)"
  },
  followers: {
    glyph: null,
    lucide: "users",
    color: "var(--text-muted)"
  }
};
function MetricChip({
  kind = "likes",
  value,
  glyph,
  style,
  ...rest
}) {
  const k = KINDS[kind] || KINDS.likes;
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      padding: "3px 9px",
      font: `var(--fw-medium) var(--fs-mono)/1 var(--font-mono)`,
      color: "var(--text-body)",
      background: "var(--surface-inset)",
      border: "1px solid var(--border-subtle)",
      borderRadius: "var(--radius-pill)",
      fontVariantNumeric: "tabular-nums",
      whiteSpace: "nowrap",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      lineHeight: 1,
      color: k.color,
      display: "inline-flex"
    }
  }, glyph ?? (k.glyph || (k.lucide ? /*#__PURE__*/React.createElement("i", {
    "data-lucide": k.lucide,
    style: {
      width: 13,
      height: 13
    }
  }) : null))), value);
}
Object.assign(__ds_scope, { MetricChip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/review/MetricChip.jsx", error: String((e && e.message) || e) }); }

// components/review/StatusChip.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Soft tinted status capsule — the review console's decision-state vocabulary.
 * Maps a ReviewStatus-like key to tone + dot + label. Never a saturated block.
 */
const MAP = {
  pending: {
    tone: "warning",
    label: "待審"
  },
  approved: {
    tone: "success",
    label: "通過"
  },
  sent: {
    tone: "success",
    label: "已送出"
  },
  rejected: {
    tone: "neutral",
    label: "跳過"
  },
  later: {
    tone: "info",
    label: "稍後再看"
  },
  blocked: {
    tone: "danger",
    label: "命中硬規則"
  },
  relevant: {
    tone: "brand",
    label: "相關"
  }
};
const TONES = {
  neutral: {
    soft: "var(--surface-inset)",
    bd: "var(--border-default)",
    tx: "var(--text-muted)",
    dot: "var(--ink-400)"
  },
  brand: {
    soft: "var(--brand-soft)",
    bd: "var(--brand-soft-bd)",
    tx: "var(--brand-700)",
    dot: "var(--brand)"
  },
  success: {
    soft: "var(--success-soft)",
    bd: "var(--success-bd)",
    tx: "var(--success-text)",
    dot: "var(--success)"
  },
  warning: {
    soft: "var(--warning-soft)",
    bd: "var(--warning-bd)",
    tx: "var(--warning-text)",
    dot: "var(--warning)"
  },
  danger: {
    soft: "var(--danger-soft)",
    bd: "var(--danger-bd)",
    tx: "var(--danger-text)",
    dot: "var(--danger)"
  },
  info: {
    soft: "var(--info-soft)",
    bd: "var(--info-bd)",
    tx: "var(--info-text)",
    dot: "var(--info)"
  }
};
function StatusChip({
  status = "pending",
  children,
  tone: toneProp,
  style,
  ...rest
}) {
  const conf = MAP[status] || MAP.pending;
  const t = TONES[toneProp || conf.tone];
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "3px 10px 3px 8px",
      font: `var(--fw-bold) var(--fs-xs)/1.5 var(--font-sans)`,
      color: t.tx,
      background: t.soft,
      border: `1px solid ${t.bd}`,
      borderRadius: "var(--radius-pill)",
      whiteSpace: "nowrap",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      borderRadius: "var(--radius-pill)",
      background: t.dot,
      flex: "none"
    }
  }), children ?? conf.label);
}
Object.assign(__ds_scope, { StatusChip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/review/StatusChip.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Avatar = __ds_scope.Avatar;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.NavItem = __ds_scope.NavItem;

__ds_ns.Field = __ds_scope.Field;

__ds_ns.TextArea = __ds_scope.TextArea;

__ds_ns.AlertBar = __ds_scope.AlertBar;

__ds_ns.MetricChip = __ds_scope.MetricChip;

__ds_ns.StatusChip = __ds_scope.StatusChip;

})();
