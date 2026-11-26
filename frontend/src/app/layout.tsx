import type { Metadata, Viewport } from "next";

import { fontVariables } from "@/app/fonts";
import { Providers } from "@/app/providers";
import { SiteFooter } from "@/components/site-footer";
import { env } from "@/lib/env";
import { cn } from "@/lib/utils";

import "@/app/globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_SITE_URL),
  title: { default: "SignalXI", template: "%s · SignalXI" },
  description: "Daily football predictions that filter risk, with every pick graded in public.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#070b12",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={cn("h-full antialiased", ...fontVariables)}>
      <body className="flex min-h-full flex-col bg-background font-sans text-foreground has-data-bottom-nav:pb-[calc(4.5rem+1px+env(safe-area-inset-bottom))] lg:has-data-bottom-nav:pb-0">
        <Providers>
          {children}
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
