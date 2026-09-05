import type { Metadata } from "next";
import { CompanyPage } from "@/components/features/landing/company-page";

export const metadata: Metadata = {
  title: { absolute: "Our Ecosystem | Bikalpo" },
  description: "Different businesses, connected through Bikalpo.",
};

export default function Page() {
  return (
    <CompanyPage
      title="Our Ecosystem"
      intro="Different businesses, connected through Bikalpo."
    >
      <section>
        <h2>Supply and distribution</h2>
        <p>
          Manufacturers, importers, distributors, and wholesalers represent the
          supply side of the platform.
        </p>
      </section>
      <section>
        <h2>Retail and local discovery</h2>
        <p>
          Retailers connect product catalogs with customers. The retailer
          directory helps visitors explore shops by location.
        </p>
      </section>
      <section>
        <h2>Property owners</h2>
        <p>
          Property owners are also part of the wider platform. More details
          about participation will be added here.
        </p>
      </section>
    </CompanyPage>
  );
}
