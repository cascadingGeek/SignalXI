import { CloudOff, TriangleAlert } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { errorCopy, type DisplayErrorKind } from "@/lib/error-copy";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  kind: DisplayErrorKind;
  requestId?: string | null;
  onAction?: () => void;
  title?: string;
  body?: string;
  className?: string;
}

/** Plain language failure panel: what happened, whose side it is on, one next step, a reference. */
export function ErrorState({ kind, requestId, onAction, title, body, className }: ErrorStateProps) {
  const copy = errorCopy[kind] ?? errorCopy.internal;
  const Icon = kind === "offline" ? CloudOff : TriangleAlert;
  const { action } = copy;

  return (
    <div
      role="alert"
      className={cn(
        "mx-auto flex max-w-sm flex-col items-center gap-3 px-5 py-10 text-center",
        className,
      )}
    >
      <span className="flex size-14 items-center justify-center rounded-2xl bg-avoid-bg text-avoid">
        <Icon aria-hidden className="size-6" />
      </span>
      <h2 className="font-display text-2xl font-extrabold tracking-tight">{title ?? copy.title}</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">{body ?? copy.body}</p>
      {action.type === "link" ? (
        <Button asChild size="lg" className="mt-1 w-full">
          <Link href={action.href}>{action.label}</Link>
        </Button>
      ) : (
        onAction && (
          <Button size="lg" className="mt-1 w-full" onClick={onAction}>
            {action.label}
          </Button>
        )
      )}
      {requestId && (
        <p className="font-mono text-xs text-muted-foreground">Error reference {requestId}</p>
      )}
    </div>
  );
}
