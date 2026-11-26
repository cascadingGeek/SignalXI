import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

interface BottomNavProps {
  items: { href: string; label: string; icon: LucideIcon }[];
  activeHref?: string;
}

/** Fixed mobile tab bar below lg; the root layout reserves its height so it never covers the footer. */
export function BottomNav({ items, activeHref }: BottomNavProps) {
  return (
    <nav
      aria-label="Primary"
      data-bottom-nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="grid h-18 grid-cols-[repeat(auto-fit,minmax(0,1fr))]">
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === activeHref;
          return (
            <li key={label} className="flex">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 flex-1 flex-col items-center justify-center gap-1 text-xs font-semibold",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon aria-hidden className="size-5" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
