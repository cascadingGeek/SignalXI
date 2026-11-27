import Link from "next/link";
import type { ReactNode } from "react";

import { BrandMark } from "@/components/brand-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

interface AppHeaderProps {
  nav?: { href: string; label: string }[];
  activeHref?: string;
  actions?: ReactNode;
}

/** Top bar: logo and wordmark, desktop navigation, theme toggle and a caller owned actions slot. */
export function AppHeader({ nav = [], activeHref, actions }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4">
        <Link
          href="/"
          aria-label="SignalXI"
          className="flex h-11 items-center gap-2.5 font-display text-xl font-extrabold tracking-tight"
        >
          <BrandMark className="size-8" />
          <span>
            Signal<span className="text-primary">XI</span>
          </span>
        </Link>
        {nav.length > 0 && (
          <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
            {nav.map((item) => {
              const active = item.href === activeHref;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-11 items-center rounded-xl px-3.5 text-sm font-semibold",
                    active
                      ? "bg-raised text-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          {actions}
        </div>
      </div>
    </header>
  );
}
