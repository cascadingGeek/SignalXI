"use client";

import { ErrorState } from "@/components/error-state";

export default function RouteError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <ErrorState kind="internal" onAction={retry} />
    </main>
  );
}
