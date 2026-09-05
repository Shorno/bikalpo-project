import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { storePolicyContent } from "@/components/storefront/store-policy-content";
import {
  isCustomerStorefrontPreview,
  withCustomerStorefrontPreview,
} from "@/lib/customer-storefront-preview";
import { getPublicStoreIdentity } from "@/lib/public-data";
import { storeFooterAnchor } from "@/lib/shop-footer-links";
import { storePolicyHref, storePolicyLinks } from "@/lib/store-policy-links";

interface StorePolicyPageProps {
  params: Promise<{ slug: string; policy: string }>;
  searchParams: Promise<{ preview?: string }>;
}

export async function generateMetadata({
  params,
}: StorePolicyPageProps): Promise<Metadata> {
  const { policy } = await params;
  const entry = storePolicyLinks.find((item) => item.id === policy);
  if (!entry) notFound();
  return {
    title: {
      absolute: `${storePolicyContent[entry.id].title} | Store Policies | Bikalpo`,
    },
    description: storePolicyContent[entry.id].intro,
  };
}

export default async function StorePolicyPage({
  params,
  searchParams,
}: StorePolicyPageProps) {
  const [{ slug, policy }, query] = await Promise.all([params, searchParams]);
  const entry = storePolicyLinks.find((item) => item.id === policy);
  if (!entry) notFound();
  const shop = await getPublicStoreIdentity(slug);
  if (!shop) notFound();
  const name = shop.shopName || shop.name;
  const previewMode = isCustomerStorefrontPreview(query.preview);
  const storeHref = withCustomerStorefrontPreview(
    `/stores/${encodeURIComponent(slug)}`,
    previewMode,
  );
  const content = storePolicyContent[entry.id];
  const linkClass =
    "inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary";

  return (
    <article className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <Link href={storeHref} className={linkClass}>
        <ArrowLeft size={16} aria-hidden="true" />
        Back to {name}
      </Link>
      <header className="mt-6">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {content.title}
        </h1>
        <p className="mt-3 text-sm font-medium text-primary">
          Shopping with {name}
        </p>
        <p className="mt-4 max-w-prose text-base leading-7 text-muted-foreground">
          {content.intro}
        </p>
      </header>

      <nav
        aria-label="Store policies"
        className="mt-7 border-y border-border py-3"
      >
        <ul className="flex flex-wrap gap-x-6 gap-y-1">
          {storePolicyLinks.map((item) => (
            <li key={item.id}>
              <Link
                href={storePolicyHref(slug, item.id, previewMode)}
                aria-current={item.id === entry.id ? "page" : undefined}
                className={`${linkClass} ${item.id === entry.id ? "font-semibold underline" : ""}`}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <aside
        aria-label="Policy status"
        className="mt-7 rounded-xl border border-border bg-muted/30 px-5 py-4 text-sm leading-6 text-muted-foreground"
      >
        <p className="font-semibold text-foreground">
          Preliminary policy information
        </p>
        <p className="mt-1">
          These pages share Bikalpo's general guidance for shopping with this
          store. Separate store terms and final policy details have not yet been
          published here.
        </p>
      </aside>

      <div className="mt-9 space-y-8">
        {content.sections.map((section) => (
          <section key={section.title}>
            <h2 className="text-lg font-semibold text-foreground sm:text-xl">
              {section.title}
            </h2>
            {section.paragraphs.map((paragraph) => (
              <p
                key={paragraph}
                className="mt-3 max-w-prose text-base leading-7 text-muted-foreground"
              >
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </div>

      <section className="mt-10 border-t border-border pt-6">
        <h2 className="text-lg font-semibold">Need help with an order?</h2>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1">
          <a
            href={storeFooterAnchor(slug, "store-information", previewMode)}
            className={linkClass}
          >
            Contact store
          </a>
          <Link href="/account/orders" className={linkClass}>
            View my orders
          </Link>
          <Link href="/account/support" className={linkClass}>
            Support tickets
          </Link>
        </div>
        <p className="mt-5 text-sm leading-6 text-muted-foreground">
          Bikalpo's{" "}
          <Link
            href="/terms"
            className="text-primary underline underline-offset-4"
          >
            Terms &amp; Conditions
          </Link>{" "}
          and{" "}
          <Link
            href="/privacy"
            className="text-primary underline underline-offset-4"
          >
            Privacy Policy
          </Link>{" "}
          provide platform-wide information.
        </p>
      </section>
    </article>
  );
}
