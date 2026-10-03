/** Shared To-Let action button: solid primary, leading icon, matches the storefront "Add to cart" button. */
export const toLetPrimaryButton =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-60 aria-disabled:opacity-60";

/**
 * Below md the page would otherwise be a column of blue blocks: supporting
 * actions keep the same shape but drop to an outlined style on phones.
 */
export const toLetMobileSecondary =
  "max-md:border max-md:border-border max-md:bg-card max-md:text-foreground max-md:hover:bg-muted";

/** Category / filter chip: same shape and weight as the action buttons, blue only when selected. */
export function toLetChip(active: boolean) {
  return `inline-flex min-h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border px-3.5 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
    active
      ? "border-primary bg-primary text-primary-foreground"
      : "border-border bg-card text-foreground hover:border-primary/40 hover:text-primary"
  }`;
}

/** Horizontal chip rows scroll by swipe; hide the browser scrollbar track under them. */
export const toLetChipRow = "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

/** Same shape for use on dark imagery, where a second blue button would disappear. */
export const toLetInverseButton =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";
