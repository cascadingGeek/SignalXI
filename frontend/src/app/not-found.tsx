import { Flag } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-20 text-center">
      <span className="flex size-16 items-center justify-center rounded-2xl bg-moderate-bg text-moderate">
        <Flag aria-hidden className="size-7" />
      </span>
      <p className="font-mono text-sm text-muted-foreground">404</p>
      <h1 className="font-display text-4xl font-extrabold tracking-tight md:text-5xl">
        This page is offside
      </h1>
      <p className="max-w-sm text-muted-foreground">
        The link may be old, or the page has moved. Today&apos;s slate is still where you left it.
      </p>
      <Button asChild size="lg" className="mt-2">
        <Link href="/">Back to the slate</Link>
      </Button>
    </main>
  );
}
