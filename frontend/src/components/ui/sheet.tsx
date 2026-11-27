"use client";

import * as React from "react";
import { cn } from "cn";
import { Dialog as SheetPrimitive } from "radix-ui";

import { Button } from "@/components/ui/button";
import { XIcon } from "lucide-react";

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger({ ...props }: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose({ ...props }: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal({ ...props }: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/60 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className,
      )}
      {...props}
    />
  );
}

const SIDE_CLASSES = {
  top: "inset-x-0 top-0 h-auto border-b data-open:slide-in-from-top-10 data-closed:slide-out-to-top-10",
  right:
    "inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm data-open:slide-in-from-right-10 data-closed:slide-out-to-right-10",
  left: "inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm data-open:slide-in-from-left-10 data-closed:slide-out-to-left-10",
  bottom:
    "inset-x-0 bottom-0 max-h-[90dvh] rounded-t-[28px] border-t border-control pb-[env(safe-area-inset-bottom)] data-open:slide-in-from-bottom-10 data-closed:slide-out-to-bottom-10",
  responsive:
    "inset-x-0 bottom-0 max-h-[90dvh] rounded-t-[28px] border-t border-control pb-[env(safe-area-inset-bottom)] data-open:slide-in-from-bottom-10 data-closed:slide-out-to-bottom-10 lg:inset-x-auto lg:inset-y-0 lg:right-0 lg:h-full lg:max-h-none lg:w-full lg:max-w-md lg:rounded-none lg:border-t-0 lg:border-l lg:pb-0 lg:data-open:slide-in-from-bottom-0 lg:data-open:slide-in-from-right-10 lg:data-closed:slide-out-to-bottom-0 lg:data-closed:slide-out-to-right-10",
} as const;

/** Drawer panel; `responsive` is a bottom sheet below lg and a right side panel from lg up. */
function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: keyof typeof SIDE_CLASSES;
  showCloseButton?: boolean;
}) {
  const sheet = side === "bottom" || side === "responsive";
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        data-side={side}
        className={cn(
          "fixed z-50 flex flex-col gap-4 overflow-y-auto overscroll-contain bg-card text-sm text-card-foreground shadow-lg transition duration-200 ease-in-out motion-reduce:animate-none data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
          SIDE_CLASSES[side],
          className,
        )}
        {...props}
      >
        {sheet && (
          <span
            aria-hidden
            data-slot="sheet-handle"
            className={cn(
              "mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-control",
              side === "responsive" && "lg:hidden",
            )}
          />
        )}
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close data-slot="sheet-close" asChild>
            <Button variant="ghost" className="absolute top-3 right-3" size="icon">
              <XIcon />
              <span className="sr-only">Close</span>
            </Button>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1.5 p-4", className)}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  );
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn(
        "font-display text-xl font-extrabold tracking-tight text-foreground",
        className,
      )}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
