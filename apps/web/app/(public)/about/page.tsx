import type { Metadata } from "next";
import { CompanyPage } from "@/components/features/landing/company-page";

export const metadata: Metadata = {
  title: { absolute: "About Us | Bikalpo" },
  description:
    "Bikalpo brings multi-channel digital e-commerce into one shared platform.",
};

export default function Page() {
  return (
    <CompanyPage
      title="About Us"
      intro="Bikalpo brings multi-channel digital e-commerce into one shared platform."
    >
      <section>
        <h2>Connecting commerce</h2>
        <p>
          The platform brings manufacturers, importers, distributors,
          wholesalers, retailers, and property owners into a shared commerce
          ecosystem.
        </p>
      </section>
      <section>
        <h2>Explore Bikalpo</h2>
        <p>
          Browse products and discover sellers by registered business location.
          More information about our story and team will be added here.
        </p>
      </section>
    </CompanyPage>
  );
}
