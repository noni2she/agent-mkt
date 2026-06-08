import type { ChangeEvent, CSSProperties } from "react";

/**
 * Draft editor — the surface where a reviewer rewrites the AI reply draft.
 *
 * @startingPoint section="Forms" subtitle="Draft editor with counter + empty state" viewport="700x240"
 */
export interface TextAreaProps {
  value?: string;
  onChange?: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  rows?: number;
  /** Dashed "stage-2 not yet generated" placeholder state. */
  empty?: boolean;
  /** Character budget (drafts target ≤60). Shows a counter that turns red when over. */
  maxHint?: number;
  label?: string;
  disabled?: boolean;
  style?: CSSProperties;
}

export function TextArea(props: TextAreaProps): JSX.Element;
