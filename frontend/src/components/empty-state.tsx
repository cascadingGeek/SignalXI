import { Inbox, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: string;
  body: string;
  icon?: LucideIcon;
  action?: { label: string; onClick: () => void } | { label: string; href: string };
  className?: string;
}

/** Shown when a request worked but there is nothing to list yet. */
export function EmptyState({
  title,
  body,
  icon: Icon = Inbox,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "mx-auto flex max-w-sm flex-col items-center gap-3 px-5 py-10 text-center",
        className,
      )}
    >
      <span className="flex size-14 items-center justify-center rounded-2xl bg-accent text-primary">
        <Icon aria-hidden className="size-6" />
      </span>
      <h2 className="font-display text-2xl font-extrabold tracking-tight">{title}</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
      {action &&
        ("href" in action ? (
          <Button asChild variant="outline" size="lg" className="mt-1 w-full">
            <Link href={action.href}>{action.label}</Link>
          </Button>
        ) : (
          <Button variant="outline" size="lg" className="mt-1 w-full" onClick={action.onClick}>
            {action.label}
          </Button>
        ))}
    </div>
  );
}
