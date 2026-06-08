import type { ReactNode, CSSProperties } from "react";

/** Surface container — white card, sunken or inset well. */
export interface CardProps {
  children?: ReactNode;
  /** Padding in px. @default 18 */
  pad?: number;
  /** Adds the soft card shadow. */
  elevated?: boolean;
  /** @default "card" */
  tone?: "card" | "sunken" | "inset";
  style?: CSSProperties;
}

export function Card(props: CardProps): JSX.Element;
