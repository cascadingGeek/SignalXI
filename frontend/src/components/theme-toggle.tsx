"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";

const noopSubscribe = () => () => {};

/** Switches between Midnight and Light; the choice is stored on the device by next-themes. */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

  if (!mounted) {
    return <Button variant="outline" size="icon" aria-label="Switch theme" />;
  }

  const isMidnight = resolvedTheme !== "light";
  return (
    <Button
      variant="outline"
      size="icon"
      aria-label={isMidnight ? "Switch to light mode" : "Switch to midnight mode"}
      onClick={() => setTheme(isMidnight ? "light" : "dark")}
    >
      {isMidnight ? (
        <SunIcon aria-hidden className="size-5" />
      ) : (
        <MoonIcon aria-hidden className="size-5" />
      )}
    </Button>
  );
}
