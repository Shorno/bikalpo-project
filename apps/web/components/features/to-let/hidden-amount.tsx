import { Lock } from "lucide-react";

export function HiddenAmount({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-2 align-middle ${className}`}
      title="The owner has hidden this amount"
    >
      <span
        aria-hidden="true"
        className="select-none font-mono tabular-nums blur-[5px]"
      >
        ৳88,888
      </span>
      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 font-sans text-[11px] font-medium tracking-normal text-muted-foreground">
        <Lock className="size-3" aria-hidden="true" />
        Hidden
        <span className="sr-only"> by owner</span>
      </span>
    </span>
  );
}
