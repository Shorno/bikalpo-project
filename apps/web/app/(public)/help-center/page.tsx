import type { Metadata } from "next";
import { CompanyPage } from "@/components/features/landing/company-page";

export const metadata: Metadata = {
  title: { absolute: "Help Center | Bikalpo" },
  description: "Start here for basic help with Bikalpo.",
};

export default function Page() {
  return (
    <CompanyPage
      title="Help Center"
      intro="Start here for basic help with Bikalpo."
    >
      <section>
        <h2>Finding products</h2>
        <p>
          Use the product catalog to explore available products and their
          details.
        </p>
      </section>
      <section>
        <h2>Finding sellers</h2>
        <p>
          Choose a location in the footer to open the seller directory for that
          location.
        </p>
      </section>
      <section>
        <h2>Getting help</h2>
        <p>
          Contact details are currently provisional. Support channels and
          detailed ordering guidance will be added before this page is
          finalized.
        </p>
      </section>
    </CompanyPage>
  );
}
