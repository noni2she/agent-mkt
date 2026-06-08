import type { ReactNode, CSSProperties } from "react";

/**
 * Primary action control for agent-mkt. Variant carries meaning:
 * `primary` = the approve/go (brand teal), `danger` = destructive,
 * `secondary`/`ghost` = neutral.
 *
 * @startingPoint section="Core" subtitle="Buttons — primary / secondary / ghost / danger" viewport="700x180"
 */
export interface ButtonProps {
  children?: ReactNode;
  /** Visual + semantic role. @default "secondary" */
  variant?: "primary" | "secondary" | "ghost" | "danger";
  /** @default "md" */
  size?: "sm" | "md" | "lg";
  /** Leading icon node (e.g. a Lucide <i>). */
  icon?: ReactNode;
  /** Trailing icon node. */
  iconRight?: ReactNode;
  disabled?: boolean;
  /** Stretch to container width. */
  full?: boolean;
  type?: "button" | "submit" | "reset";
  onClick?: () => void;
  style?: CSSProperties;
}

export function Button(props: ButtonProps): JSX.Element;
