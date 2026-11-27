import { cn } from "@/lib/utils";

const BARS = [
  { points: "8,56 17,56 17,40.6 8,46", delay: "[animation-delay:0ms]" },
  { points: "22,56 31,56 31,32.2 22,37.6", delay: "[animation-delay:120ms]" },
  { points: "36,56 45,56 45,23.8 36,29.2", delay: "[animation-delay:240ms]" },
] as const;

/** Full screen or inline loader: the logo's bars rise in turn and the ball bounces off the top bar. */
export function BrandLoader({
  label = "Loading",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("flex flex-col items-center gap-3 text-muted-foreground", className)}
    >
      <svg viewBox="0 -8 64 72" aria-hidden className="size-16 overflow-visible">
        <g className="fill-primary stroke-primary" strokeLinejoin="round" strokeWidth={3}>
          {BARS.map((b) => (
            <polygon
              key={b.points}
              points={b.points}
              className={cn(
                "origin-bottom [transform-box:fill-box] motion-safe:animate-signal-bar",
                b.delay,
              )}
            />
          ))}
        </g>
        <circle
          cx="52.5"
          cy="16"
          r="6.5"
          className="origin-bottom fill-foreground [transform-box:fill-box] motion-safe:animate-signal-ball"
        />
      </svg>
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}
