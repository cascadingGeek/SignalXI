import { env } from "@/lib/env";
import { cn } from "@/lib/utils";

export type AdSize = "728x90" | "300x250" | "300x600" | "970x90" | "320x50" | "320x100" | "native";
export type ViewerTier = "guest" | "free" | "premium";

/** Pixel box plus the smallest breakpoint each IAB size may show at. */
const AD_SIZES: Record<AdSize, { box: string; visibility: string; label: string }> = {
  "320x50": { box: "h-[50px] w-[320px]", visibility: "flex", label: "320 × 50" },
  "320x100": { box: "h-[100px] w-[320px]", visibility: "flex", label: "320 × 100" },
  "300x250": { box: "h-[250px] w-[300px]", visibility: "flex", label: "300 × 250" },
  native: { box: "h-[110px] w-full", visibility: "flex", label: "Native" },
  "728x90": { box: "h-[90px] w-[728px]", visibility: "hidden md:flex", label: "728 × 90" },
  "970x90": { box: "h-[90px] w-[970px]", visibility: "hidden md:flex", label: "970 × 90" },
  "300x600": { box: "h-[600px] w-[300px]", visibility: "hidden xl:flex", label: "300 × 600" },
};

interface AdSlotProps {
  size: AdSize;
  viewerTier: ViewerTier;
  placement?: string;
  className?: string;
}

/** Reserves a fixed ad box for guests and free members; premium never sees ads. Pass `placement` when a page has several slots. */
export function AdSlot({ size, viewerTier, placement, className }: AdSlotProps) {
  const spec = AD_SIZES[size];
  if (!env.NEXT_PUBLIC_ADS_ENABLED || viewerTier === "premium" || !spec) return null;

  return (
    <aside
      aria-label={placement ? `Advertisement, ${placement}` : "Advertisement"}
      data-ad-slot
      data-ad-size={size}
      className={cn("max-w-full flex-col items-center gap-1", spec.visibility, className)}
    >
      <span aria-hidden className="text-[10px] font-medium tracking-[0.12em] text-muted-foreground">
        ADVERTISEMENT
      </span>
      <div
        className={cn(
          "flex max-w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-ad-line bg-ad font-mono text-xs text-muted-foreground",
          spec.box,
        )}
      >
        {spec.label}
      </div>
    </aside>
  );
}
