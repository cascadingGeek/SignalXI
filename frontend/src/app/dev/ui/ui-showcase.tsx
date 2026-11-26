"use client";

import { ChartColumn, CircleUser, LayoutList, ReceiptText } from "lucide-react";
import { useState } from "react";

import { AdSlot, type AdSize } from "@/components/ad-slot";
import { AppHeader } from "@/components/app-header";
import { BottomNav } from "@/components/bottom-nav";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { ResponsibleGamblingNote } from "@/components/responsible-gambling-note";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClassificationBadge } from "@/features/predictions/classification-badge";
import type { Classification } from "@/features/predictions/predictions.types";
import { errorCopy, type DisplayErrorKind } from "@/lib/error-copy";
import { cn } from "@/lib/utils";

const CLASSES: Classification[] = ["STRONG", "MODERATE", "HIGH_RISK_AVOID", "INSUFFICIENT_DATA"];
const AD_SIZES: AdSize[] = [
  "320x50",
  "320x100",
  "300x250",
  "native",
  "728x90",
  "970x90",
  "300x600",
];
const ERROR_KINDS = Object.keys(errorCopy) as DisplayErrorKind[];
const NAV = [
  { href: "#", label: "Slate", icon: LayoutList },
  { href: "#slip-audit", label: "Slip audit", icon: ReceiptText },
  { href: "#ledger", label: "Ledger", icon: ChartColumn },
  { href: "#account", label: "Account", icon: CircleUser },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-xs font-bold tracking-[0.14em] text-primary uppercase">{title}</h3>
      {children}
    </section>
  );
}

function SamplePick() {
  return (
    <Card size="sm">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">UCL · 18:45 WAT</span>
          <ClassificationBadge classification="STRONG" />
        </div>
        <CardTitle className="text-base">
          Arsenal <span className="font-normal text-muted-foreground">vs</span> Bayern
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between rounded-xl bg-raised px-3 py-2.5">
          <span className="font-semibold">Over 1.5 Goals</span>
          <span className="rounded-lg bg-pill px-2 py-1 font-mono font-semibold tabular-nums">
            1.28
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function Panel({ theme }: { theme: "dark" | "light" }) {
  const id = (name: string) => `${theme}-${name}`;
  const [agreed, setAgreed] = useState(false);
  const [retried, setRetried] = useState(0);

  return (
    <div
      className={cn(
        theme,
        "flex flex-col gap-8 rounded-3xl border border-border bg-background p-5 text-foreground",
      )}
      data-panel={theme}
    >
      <h2 className="font-display text-3xl font-extrabold tracking-tight">
        {theme === "dark" ? "Midnight" : "Light"}
      </h2>

      <Section title="Type">
        <p className="font-display text-5xl leading-none font-extrabold tracking-tight">
          Know which games to avoid
        </p>
        <p className="text-base">Bayern concede first in 4 of their last 6 away games.</p>
        <p className="font-mono text-lg font-semibold tabular-nums">
          1.28 · 3.85 · 18:45 · SX-500-7F3A
        </p>
      </Section>

      <Section title="Classification badges">
        <div className="flex flex-wrap gap-2">
          {CLASSES.map((c) => (
            <ClassificationBadge key={c} classification={c} />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {CLASSES.map((c) => (
            <ClassificationBadge key={c} classification={c} size="md" />
          ))}
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap gap-2">
          <Button>Unlock all picks</Button>
          <Button variant="outline">Clear filters</Button>
          <Button variant="secondary">Tomorrow</Button>
          <Button variant="ghost">Ledger</Button>
          <Button variant="destructive">Remove leg</Button>
        </div>
      </Section>

      <Section title="Form">
        <div className="flex flex-col gap-2">
          <Label htmlFor={id("email")}>Email</Label>
          <Input id={id("email")} type="email" placeholder="you@example.com" autoComplete="email" />
        </div>
        <label
          htmlFor={id("age")}
          className="flex min-h-11 cursor-pointer items-center gap-3 text-sm"
        >
          <Checkbox
            id={id("age")}
            checked={agreed}
            onCheckedChange={(v) => setAgreed(v === true)}
          />
          I am 18 or older
        </label>
      </Section>

      <Section title="Tabs">
        <Tabs defaultValue="main">
          <TabsList className="w-full">
            {["Main", "Goals", "Half", "Specials"].map((t) => (
              <TabsTrigger key={t} value={t.toLowerCase()}>
                {t}
              </TabsTrigger>
            ))}
          </TabsList>
          {["main", "goals", "half", "specials"].map((t) => (
            <TabsContent key={t} value={t} className="pt-2 text-muted-foreground">
              {t} market picks appear here.
            </TabsContent>
          ))}
        </Tabs>
      </Section>

      <Section title="Card and drawer">
        <SamplePick />
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline">Open fixture drawer</Button>
          </SheetTrigger>
          <SheetContent side="bottom">
            <SheetHeader>
              <SheetTitle>Arsenal vs Bayern</SheetTitle>
              <SheetDescription>Fixture analysis opens in this drawer.</SheetDescription>
            </SheetHeader>
            <div className="px-4 pb-6">
              <SamplePick />
            </div>
          </SheetContent>
        </Sheet>
      </Section>

      <Section title="Loading">
        <div
          role="status"
          aria-busy="true"
          aria-label="Loading today's slate"
          className="flex flex-col gap-3"
        >
          {[0, 1].map((k) => (
            <div
              key={k}
              className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4"
            >
              <div className="flex justify-between">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-11 rounded-xl" />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Errors">
        <div className="grid gap-3 sm:grid-cols-2">
          {ERROR_KINDS.map((kind) => (
            <div key={kind} className="rounded-2xl border border-border bg-card">
              <ErrorState
                kind={kind}
                requestId={kind === "internal" ? "SX-500-7F3A" : null}
                onAction={() => setRetried((n) => n + 1)}
                className="py-6"
              />
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          Retry pressed {retried} times
        </p>
      </Section>

      <Section title="Empty">
        <div className="rounded-2xl border border-border bg-card">
          <EmptyState
            title="No picks for this filter yet"
            body="The slate publishes by 09:00 WAT. Try another competition meanwhile."
            action={{ label: "Clear filters", onClick: () => undefined }}
          />
        </div>
      </Section>

      <Section title="Ad slots">
        <div className="flex flex-col items-start gap-4 overflow-hidden">
          {AD_SIZES.map((size) => (
            <AdSlot key={size} size={size} viewerTier="guest" placement={`${theme} ${size}`} />
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Premium viewers see none of these.</p>
      </Section>

      <ResponsibleGamblingNote />
    </div>
  );
}

/** Dev only catalogue of every foundation part, in both themes and every state. */
export function UiShowcase() {
  return (
    <>
      <AppHeader
        nav={[
          { href: "#", label: "Slate" },
          { href: "#ledger", label: "Ledger" },
          { href: "#pricing", label: "Pricing" },
        ]}
        actions={<Button>Sign in</Button>}
      />
      <main className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-6 xl:grid-cols-2">
        <h1 className="sr-only">UI foundation</h1>
        <Panel theme="dark" />
        <Panel theme="light" />
      </main>
      <BottomNav items={NAV} activeHref="#" />
    </>
  );
}
