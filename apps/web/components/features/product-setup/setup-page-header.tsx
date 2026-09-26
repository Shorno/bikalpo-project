import { Layers3 } from "lucide-react";
import type { ReactNode } from "react";

type SetupPageHeaderProps = {
  title: string;
  description: string;
  count?: number;
  metrics?: Array<{ label: string; value: ReactNode }>;
};

export function SetupPageHeader({
  title,
  description,
  count,
  metrics,
}: SetupPageHeaderProps) {
  const displayedMetrics =
    metrics ?? (count === undefined ? [] : [{ label: title, value: count }]);

  return (
    <header className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex items-center gap-3.5 p-5 max-md:gap-3 max-md:p-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15 max-md:size-9">
          <Layers3 aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight max-md:text-base">
            {title}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground max-md:text-xs">
            {description}
          </p>
        </div>
      </div>
      {displayedMetrics.length > 0 && (
        <dl
          className="grid divide-x border-t bg-muted/30"
          style={{
            gridTemplateColumns: `repeat(${displayedMetrics.length}, minmax(0, 1fr))`,
          }}
        >
          {displayedMetrics.map((metric) => (
            <div
              className="flex flex-col px-4 py-3.5 text-center max-md:px-2 max-md:py-2.5"
              key={metric.label}
            >
              <dt className="order-2 mt-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground max-md:text-[10px]">
                {metric.label}
              </dt>
              <dd className="order-1 text-lg font-semibold leading-none tabular-nums">
                {metric.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </header>
  );
}
