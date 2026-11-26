import { CircleCheck, CircleHelp, CircleMinus, TriangleAlert, type LucideIcon } from "lucide-react";

import type { Classification } from "@/features/predictions/predictions.types";
import { cn } from "@/lib/utils";

interface BadgeStyle {
  label: string;
  icon: LucideIcon;
  className: string;
}

export const CLASSIFICATION_BADGES: Record<Classification, BadgeStyle> = {
  STRONG: { label: "Strong Candidate", icon: CircleCheck, className: "bg-strong-bg text-strong" },
  MODERATE: {
    label: "Moderate Candidate",
    icon: CircleMinus,
    className: "bg-moderate-bg text-moderate",
  },
  HIGH_RISK_AVOID: {
    label: "High Risk (Avoid)",
    icon: TriangleAlert,
    className: "bg-avoid-bg text-avoid",
  },
  INSUFFICIENT_DATA: {
    label: "Insufficient Data",
    icon: CircleHelp,
    className: "bg-insufficient-bg text-insufficient",
  },
};

interface ClassificationBadgeProps {
  classification: Classification;
  size?: "sm" | "md";
  className?: string;
}

/** Risk label for a pick; meaning is carried by the text, the colour only reinforces it. */
export function ClassificationBadge({
  classification,
  size = "sm",
  className,
}: ClassificationBadgeProps) {
  const { label, icon: Icon, className: tone } = CLASSIFICATION_BADGES[classification];
  return (
    <span
      data-classification={classification}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full font-semibold whitespace-nowrap",
        size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
        tone,
        className,
      )}
    >
      <Icon aria-hidden className={size === "sm" ? "size-3.5" : "size-4"} />
      {label}
    </span>
  );
}
