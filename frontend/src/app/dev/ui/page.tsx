import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { UiShowcase } from "@/app/dev/ui/ui-showcase";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  title: "UI foundation",
  robots: { index: false, follow: false },
};

export default function DevUiPage() {
  if (env.NEXT_PUBLIC_APP_ENV === "production") notFound();
  return <UiShowcase />;
}
