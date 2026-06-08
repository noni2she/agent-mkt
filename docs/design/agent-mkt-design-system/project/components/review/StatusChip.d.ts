import type { ReactNode, CSSProperties } from "react";

/**
 * Soft tinted decision-state capsule for the review queue.
 *
 * @startingPoint section="Review" subtitle="Status capsules — pending / approved / blocked / sent" viewport="700x120"
 */
export interface StatusChipProps {
  /** Maps to tone + default label. @default "pending" */
  status?: "pending" | "approved" | "sent" | "rejected" | "later" | "blocked" | "relevant";
  /** Override the default label text. */
  children?: ReactNode;
  /** Force a tone independent of status. */
  tone?: "neutral" | "brand" | "success" | "warning" | "danger" | "info";
  style?: CSSProperties;
}

export function StatusChip(props: StatusChipProps): JSX.Element;
