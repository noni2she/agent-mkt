import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Badge } from "./Badge";

interface NavItemProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  label: string;
  active?: boolean;
  count?: number;
}

export function NavItem({ icon, label, active = false, count, className = "", ...props }: NavItemProps) {
  return (
    <button
      type="button"
      className={`flex w-full cursor-pointer items-center gap-[11px] rounded-[var(--radius-md)] border px-[11px] py-[9px] text-left transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out)] [font:var(--fw-medium)_var(--fs-sm)/1_var(--font-sans)] ${active ? "border-[var(--brand-soft-bd)] bg-[var(--brand-soft)] text-[var(--brand-700)]" : "border-transparent bg-transparent text-[var(--text-body)] hover:bg-[var(--surface-inset)]"} ${className}`}
      {...props}
    >
      <span className={`inline-flex h-[18px] w-[18px] ${active ? "text-[var(--brand)]" : "text-[var(--text-muted)]"} [&>svg]:h-full [&>svg]:w-full`}>{icon}</span>
      <span className="flex-1 whitespace-nowrap">{label}</span>
      {count != null ? <Badge tone={active ? "brand" : "neutral"} solid={active}>{count}</Badge> : null}
    </button>
  );
}
