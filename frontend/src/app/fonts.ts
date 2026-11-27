import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["600", "800"],
  variable: "--font-bricolage",
  display: "swap",
});
const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans", display: "swap" });
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
  preload: false,
});

/** CSS variable classes for the three self hosted families, applied on <html>. */
export const fontVariables = [bricolage.variable, geistSans.variable, geistMono.variable];
