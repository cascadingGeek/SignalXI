import type { Classification } from "@/features/predictions/predictions.types";
import { cn } from "@/lib/utils";

interface BadgeStyle {
  label: string;
  bars: 0 | 1 | 2 | 3;
  className: string;
}

export const CLASSIFICATION_BADGES: Record<Classification, BadgeStyle> = {
  STRONG: { label: "Strong Candidate", bars: 3, className: "bg-strong-bg text-strong" },
  MODERATE: { label: "Moderate Candidate", bars: 2, className: "bg-moderate-bg text-moderate" },
  HIGH_RISK_AVOID: { label: "High Risk (Avoid)", bars: 1, className: "bg-avoid-bg text-avoid" },
  INSUFFICIENT_DATA: {
    label: "Insufficient Data",
    bars: 0,
    className: "bg-insufficient-bg text-insufficient",
  },
};

const BARS = [
  { x: 0, y: 9, h: 5 },
  { x: 6, y: 5, h: 9 },
  { x: 12, y: 1, h: 13 },
] as const;

/** Three rising signal bars; `lit` of them are filled, none lit draws dashed outlines. */
export function SignalBars({ lit, className }: { lit: 0 | 1 | 2 | 3; className?: string }) {
  return (
    <svg
      viewBox="0 0 16 14"
      aria-hidden
      data-lit={lit}
      className={cn("shrink-0 fill-current", className)}
    >
      {BARS.map((b, i) =>
        lit === 0 ? (
          <rect
            key={b.x}
            x={b.x + 0.5}
            y={b.y + 0.5}
            width={3}
            height={b.h - 1}
            rx={1}
            className="fill-none stroke-current"
            strokeDasharray="1.5 1.5"
          />
        ) : (
          <rect
            key={b.x}
            x={b.x}
            y={b.y}
            width={4}
            height={b.h}
            rx={1}
            className={i < lit ? undefined : "opacity-25"}
          />
        ),
      )}
    </svg>
  );
}

interface ClassificationBadgeProps {
  classification: Classification;
  size?: "sm" | "md";
  className?: string;
}

/** Risk label for a pick; meaning is carried by the text, the bars and colour only reinforce it. */
export function ClassificationBadge({
  classification,
  size = "sm",
  className,
}: ClassificationBadgeProps) {
  const { label, bars, className: tone } = CLASSIFICATION_BADGES[classification];
  return (
    <span
      data-classification={classification}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full font-semibold whitespace-nowrap",
        size === "sm" ? "py-1 pr-2.5 pl-2 text-xs" : "py-1.5 pr-3 pl-2.5 text-sm",
        tone,
        className,
      )}
    >
      <SignalBars lit={bars} className={size === "sm" ? "h-3 w-3.5" : "h-3.5 w-4"} />
      {label}
    </span>
  );
}
