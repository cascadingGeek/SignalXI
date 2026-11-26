import { cn } from "@/lib/utils";

interface ResponsibleGamblingNoteProps {
  variant?: "inline" | "footer";
  className?: string;
}

/** The 18+ and responsible gambling disclosure every surface must show. */
export function ResponsibleGamblingNote({
  variant = "inline",
  className,
}: ResponsibleGamblingNoteProps) {
  return (
    <p
      className={cn(
        "text-xs leading-relaxed text-muted-foreground",
        variant === "footer" && "text-center",
        className,
      )}
    >
      <strong className="font-semibold text-foreground">18+ only.</strong> Statistical analysis, not
      guaranteed outcomes. Bet responsibly.
    </p>
  );
}
