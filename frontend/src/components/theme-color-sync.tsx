"use client";

import { useEffect } from "react";

function applyThemeColor() {
  const root = document.documentElement;
  const color = getComputedStyle(root).getPropertyValue("--background").trim();
  if (!color) return;
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.append(meta);
  }
  meta.content = color;
}

/** Keeps the browser bar colour (`theme-color` meta) in step with the theme class on <html>. */
export function ThemeColorSync() {
  useEffect(() => {
    applyThemeColor();
    const observer = new MutationObserver(applyThemeColor);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return null;
}
