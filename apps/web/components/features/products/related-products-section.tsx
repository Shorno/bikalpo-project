import type { ReactNode } from "react";

/** Card shell shared by the landing-page and store related-product rows. */
export function RelatedProductsSection({ children }: { children: ReactNode }) {
  return (
    <section
      aria-labelledby="related-products-heading"
      className="mt-6 rounded-lg border border-zinc-200 bg-white p-5 sm:p-7"
    >
      <h2
        className="mb-5 text-base font-bold uppercase tracking-wide text-zinc-950"
        id="related-products-heading"
      >
        Related Products
      </h2>
      {children}
    </section>
  );
}
