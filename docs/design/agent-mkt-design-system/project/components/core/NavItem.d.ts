import type { ReactNode, CSSProperties } from "react";

/** Sidebar navigation row with icon, label, active state and optional count. */
export interface NavItemProps {
  /** Icon node (e.g. a Lucide <i>). */
  icon?: ReactNode;
  label: ReactNode;
  active?: boolean;
  /** Optional trailing count pill. */
  count?: number;
  onClick?: () => void;
  style?: CSSProperties;
}

export function NavItem(props: NavItemProps): JSX.Element;
