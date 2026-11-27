import { ResponsibleGamblingNote } from "@/components/responsible-gambling-note";

/** Site wide footer carrying the responsible gambling disclosure. */
export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card px-4 py-5">
      <ResponsibleGamblingNote variant="footer" className="mx-auto max-w-3xl" />
    </footer>
  );
}
