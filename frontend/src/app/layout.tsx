import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import { Providers } from "@/app/providers";
import { env } from "@/lib/env";
import { cn } from "@/lib/utils";

import "@/app/globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_SITE_URL),
  title: { default: "SignalXI", template: "%s · SignalXI" },
  description: "Daily football predictions that filter risk, with every pick graded in public.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={cn("h-full antialiased", inter.variable)}>
      <body className="flex min-h-full flex-col bg-background font-sans text-foreground">
        <Providers>{children}</Providers>
        <footer className="border-t px-4 py-4 text-center text-xs text-muted-foreground">
          18+ only. Betting carries risk: predictions are not guarantees. Bet responsibly.
        </footer>
      </body>
    </html>
  );
}
