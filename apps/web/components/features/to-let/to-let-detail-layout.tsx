import { Check, Eye, MapPin, X } from "lucide-react";
import type { ElementType, ReactNode } from "react";
import { PublicListingGallery } from "@/components/features/to-let/public-listing-gallery";

type StatusTone = "blue" | "emerald" | "amber" | "red" | "neutral";

const statusToneClassName: Record<StatusTone, string> = {
  blue: "border-primary/20 bg-primary/5 text-primary",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
  amber: "border-amber-200 bg-amber-50 text-amber-800",
  red: "border-red-200 bg-red-50 text-red-800",
  neutral: "border-border bg-muted/30 text-foreground",
};

interface ToLetDetailHeroProps {
  imageUrls: string[];
  imageAlt: string;
  code: string;
  title: string;
  propertyName: string;
  location: string;
  unitCode: string;
  unitName: string;
  category: string;
  size: string;
  monthlyRent: string;
  statusLabel: string;
  statusTone?: StatusTone;
  dateLabel: string;
  dateValue: string;
  viewCount?: number;
  statusDetail?: string;
  actions?: ReactNode;
  showHeading?: boolean;
  documentOrder?: boolean;
  tourUrl?: string | null;
}

export function ToLetDetailHero({
  imageUrls,
  imageAlt,
  code,
  title,
  propertyName,
  location,
  unitCode,
  unitName,
  category,
  size,
  monthlyRent,
  statusLabel,
  statusTone = "blue",
  dateLabel,
  dateValue,
  viewCount,
  statusDetail,
  actions,
  showHeading = true,
  documentOrder = false,
  tourUrl,
}: ToLetDetailHeroProps) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.12fr)]">
        <div className="border-b border-border p-4 sm:p-6 lg:border-r lg:border-b-0 lg:p-8">
          <PublicListingGallery imageUrls={imageUrls} alt={imageAlt} />
          {tourUrl ? (
            <a
              href={tourUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex min-h-10 items-center rounded-md border border-border px-4 text-sm font-semibold text-primary hover:bg-primary/5"
            >
              Open 360° tour{" "}
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col p-5 sm:p-7 lg:p-8">
          {!documentOrder ? (
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                {showHeading ? (
                  <>
                    <p className="font-mono text-xs font-semibold tracking-[0.08em] text-primary uppercase">
                      {code}
                    </p>
                    <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                      {title}
                    </h1>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">Property</p>
                    <h2 className="mt-1 text-lg font-semibold text-foreground">
                      {propertyName}
                    </h2>
                  </>
                )}
              </div>
              <span
                className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusToneClassName[statusTone]}`}
              >
                {statusLabel}
              </span>
            </div>
          ) : null}

          {!documentOrder ? (
            <div className="mt-6 border-b border-border pb-5">
              <p className="text-sm text-muted-foreground">Monthly rent</p>
              <p className="mt-1 font-mono text-3xl font-bold tabular-nums text-foreground">
                {monthlyRent}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">per month</p>
            </div>
          ) : null}

          <dl className="divide-y divide-zinc-100 text-sm">
            {!showHeading && !documentOrder ? (
              <ToLetSummaryRow label="Listing ID" value={code} mono />
            ) : null}
            {showHeading || documentOrder ? (
              <ToLetSummaryRow label="Property Name" value={propertyName} />
            ) : null}
            <ToLetSummaryRow label="Location">
              <span className="inline-flex items-start gap-2">
                <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>{location}</span>
              </span>
            </ToLetSummaryRow>
            <ToLetSummaryRow label="Unit ID" value={unitCode} mono />
            <ToLetSummaryRow label="Unit Name" value={unitName} />
            <ToLetSummaryRow label="Category" value={category} />
            {typeof viewCount === "number" ? (
              <ToLetSummaryRow label="Views">
                <span className="inline-flex items-center gap-2 font-mono font-semibold text-foreground">
                  <Eye className="size-4 text-primary" />
                  {viewCount.toLocaleString("en-BD")}
                </span>
              </ToLetSummaryRow>
            ) : null}
            <ToLetSummaryRow label="Size" value={size} mono />
            {documentOrder ? (
              <>
                <ToLetSummaryRow
                  label="Monthly Rent"
                  value={monthlyRent}
                  mono
                />
                <ToLetSummaryRow label="Status" value={statusLabel} />
              </>
            ) : null}
            <ToLetSummaryRow label={dateLabel} value={dateValue} mono />
          </dl>

          {statusDetail ? (
            <p
              className={`mt-5 rounded-lg border px-4 py-3 text-sm leading-6 ${statusToneClassName[statusTone]}`}
            >
              {statusDetail}
            </p>
          ) : null}

          {actions ? (
            <div className="mt-auto flex flex-wrap gap-2 border-t border-border pt-4">
              {actions}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function ToLetSummaryRow({
  label,
  value,
  children,
  mono = false,
  valueClassName = "font-semibold text-foreground",
}: {
  label: string;
  value?: ReactNode;
  children?: ReactNode;
  mono?: boolean;
  valueClassName?: string;
}) {
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-start gap-4 py-2.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={`min-w-0 ${valueClassName} ${mono ? "font-mono tabular-nums" : ""}`}
      >
        {children ?? value ?? "—"}
      </dd>
    </div>
  );
}

export function ToLetDetailsSection({
  id,
  icon: Icon,
  eyebrow,
  title,
  description,
  children,
  embedded = false,
}: {
  id?: string;
  icon: ElementType;
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
  embedded?: boolean;
}) {
  return (
    <section
      id={id}
      className={`scroll-mt-28 overflow-hidden bg-card ${
        embedded ? "" : "rounded-lg border border-border"
      }`}
    >
      <div className="border-b border-border px-5 py-4 sm:px-6">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/5 text-primary">
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <div>
            {eyebrow ? (
              <p className="text-[11px] font-semibold tracking-[0.12em] text-primary uppercase">
                {eyebrow}
              </p>
            ) : null}
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            {description ? (
              <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
        </div>
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

export function ToLetInfoTile({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="mt-1 flex min-h-10 items-center break-words rounded-md border border-border bg-muted/30 px-3 text-sm font-medium text-foreground tabular-nums">
        {value}
      </p>
    </div>
  );
}

export function ToLetFacilityItem({
  label,
  available,
  included,
}: {
  label: string;
  available: boolean | undefined;
  included?: boolean | null;
}) {
  const recorded = typeof available === "boolean";
  const stateLabel = available
    ? "Available"
    : recorded
      ? "Not available"
      : "Not recorded";

  return (
    <div className="flex min-h-16 flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 p-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p
          className={`mt-0.5 text-xs ${available ? "text-primary" : recorded ? "text-muted-foreground" : "text-amber-700"}`}
        >
          {stateLabel}
        </p>
      </div>
      {included === null ? (
        <span className="text-xs text-muted-foreground">
          Rent inclusion: Not recorded
        </span>
      ) : typeof included === "boolean" ? (
        <ToLetChoicePair
          positiveLabel="Included"
          negativeLabel="Excluded"
          positive={included}
        />
      ) : (
        <ToLetChoicePair
          positiveLabel="Yes"
          negativeLabel="No"
          positive={available === true}
          recorded={recorded}
        />
      )}
    </div>
  );
}

export function ToLetRentItem({
  label,
  value,
  included,
}: {
  label: string;
  value: ReactNode;
  included?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <div className="mt-1 flex min-h-12 flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-muted/30 px-3 py-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="break-words font-mono text-sm font-semibold text-foreground tabular-nums">
              {value}
            </p>
          </div>
        </div>
        {typeof included === "boolean" ? (
          <ToLetChoicePair
            positiveLabel="Included"
            negativeLabel="Excluded"
            positive={included}
          />
        ) : null}
      </div>
    </div>
  );
}

export function ToLetDetailsShell({
  items,
  children,
}: {
  items: ReadonlyArray<{ href: string; label: string }>;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card">
      <nav
        aria-label="Details sections"
        className="sticky top-0 z-20 overflow-x-auto border-b border-border bg-white/95 px-3 backdrop-blur [scrollbar-width:none]"
      >
        <div className="flex h-12 min-w-max items-center gap-1">
          {items.map((item, index) => (
            <a
              key={item.href}
              href={item.href}
              className={`inline-flex h-12 items-center border-b-2 px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring ${
                index === 0
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {item.label}
            </a>
          ))}
        </div>
      </nav>
      <div className="divide-y divide-zinc-200">{children}</div>
    </section>
  );
}

function ToLetChoicePair({
  positiveLabel,
  negativeLabel,
  positive,
  recorded = true,
}: {
  positiveLabel: string;
  negativeLabel: string;
  positive: boolean;
  recorded?: boolean;
}) {
  return (
    <span className="inline-flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className={`flex size-4 items-center justify-center rounded-full border ${
            recorded && positive
              ? "border-primary bg-primary text-white"
              : "border-border bg-card text-transparent"
          }`}
        >
          <Check className="size-2.5" />
        </span>
        {positiveLabel}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className={`flex size-4 items-center justify-center rounded-full border ${
            recorded && !positive
              ? "border-zinc-700 bg-zinc-700 text-white"
              : "border-border bg-card text-transparent"
          }`}
        >
          <X className="size-2.5" />
        </span>
        {negativeLabel}
      </span>
    </span>
  );
}
