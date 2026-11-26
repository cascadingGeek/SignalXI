import Link from "next/link";
import type { ReactNode } from "react";

import { ThemeToggle } from "@/components/theme-toggle";

interface AppHeaderProps {
  nav?: { href: string; label: string }[];
  actions?: ReactNode;
}

/** Top bar: wordmark, desktop navigation, theme toggle and a caller owned actions slot. */
export function AppHeader({ nav = [], actions }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4">
        <Link
          href="/"
          className="flex h-11 items-center font-display text-xl font-extrabold tracking-tight"
        >
          Signal<span className="text-primary">XI</span>
        </Link>
        {nav.length > 0 && (
          <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
            {nav.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="flex h-11 items-center rounded-xl px-3 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
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
