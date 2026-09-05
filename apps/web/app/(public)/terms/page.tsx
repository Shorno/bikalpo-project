import type { Metadata } from "next";
import { CompanyPage } from "@/components/features/landing/company-page";

export const metadata: Metadata = {
  title: { absolute: "Terms & Conditions | Bikalpo" },
  description: "Preliminary information about using Bikalpo.",
};

export default function Page() {
  return (
    <CompanyPage
      title="Terms & Conditions"
      intro="Preliminary information about using Bikalpo."
    >
      <section>
        <h2>Using the platform</h2>
        <p>
          The final terms will explain account responsibilities and the
          conditions for using the platform.
        </p>
      </section>
      <section>
        <h2>Orders and transactions</h2>
        <p>
          Purchase, payment, delivery, cancellation, and return terms will be
          described here once finalized.
        </p>
      </section>
      <section id="seller-policy">
        <h2>Seller and buyer policies</h2>
        <p id="buyer-policy">
          Additional guidance for sellers and buyers is being prepared. This
          draft does not establish final transaction policies.
        </p>
      </section>
    </CompanyPage>
  );
}
