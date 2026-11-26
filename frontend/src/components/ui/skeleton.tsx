import { cn } from "cn";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("rounded-md bg-skeleton motion-safe:animate-skeleton-pulse", className)}
      {...props}
    />
  );
}

export { Skeleton };
