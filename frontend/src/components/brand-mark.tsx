import { cn } from "@/lib/utils";

/** The SignalXI mark: three rising bars on one slanted cut, and the ball where the line lands. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={cn("shrink-0", className)}>
      <g className="fill-primary stroke-primary" strokeLinejoin="round" strokeWidth={3}>
        <polygon points="8,56 17,56 17,40.6 8,46" />
        <polygon points="22,56 31,56 31,32.2 22,37.6" />
        <polygon points="36,56 45,56 45,23.8 36,29.2" />
      </g>
      <circle cx="52.5" cy="16" r="6.5" className="fill-foreground" />
    </svg>
  );
}
