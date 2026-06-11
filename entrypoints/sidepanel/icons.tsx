import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function IconBase({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function Inbox(props: IconProps) {
  return (
    <IconBase {...props}>
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </IconBase>
  );
}

export function Radar(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M13.5 4.06A8 8 0 1 0 20 12" />
      <path d="M18.5 4.5 12 12" />
      <circle cx="12" cy="12" r="2" />
      <path d="M20 4h-4v4" />
    </IconBase>
  );
}

export function BookMarked(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M10 2v8l3-3 3 3V2" />
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </IconBase>
  );
}

export function Check(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m20 6-11 11-5-5" />
    </IconBase>
  );
}

export function X(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </IconBase>
  );
}

export function Clock(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </IconBase>
  );
}

export function ThumbsUp(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M7 10v12" />
      <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88z" />
    </IconBase>
  );
}

export function MessageCircle(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z" />
    </IconBase>
  );
}

export function Lightbulb(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M15 14c.2-1 .7-1.7 1.5-2.5A4.9 4.9 0 0 0 18 8 6 6 0 0 0 6 8c0 1.4.5 2.7 1.5 3.7.7.7 1.2 1.4 1.5 2.3" />
      <path d="M9 18h6" />
      <path d="M10 22h4" />
    </IconBase>
  );
}

export function Sun(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </IconBase>
  );
}

export function Moon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </IconBase>
  );
}

export function RefreshCw(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      <path d="M3 21v-5h5" />
    </IconBase>
  );
}
