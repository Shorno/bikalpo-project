import type { Metadata } from "next";
import { CompanyPage } from "@/components/features/landing/company-page";

export const metadata: Metadata = {
  title: { absolute: "Trust & Safety | Bikalpo" },
  description: "Information to help you use Bikalpo with care.",
};

export default function Page() {
  return (
    <CompanyPage
      title="Trust & Safety"
      intro="Information to help you use Bikalpo with care."
    >
      <section>
        <h2>Before you order</h2>
        <p>
          Review the retailer and product details, and confirm any questions
          before placing an order. Keep a record of your order and
          conversations.
        </p>
      </section>
      <section>
        <h2>Account safety</h2>
        <p>
          Keep your password and verification codes private. Use the platform
          contact page to find support information.
        </p>
      </section>
      <section>
        <h2>Reporting a concern</h2>
        <p>
          The process for reporting suspicious listings, account issues, and
          disputes will be published here when finalized.
        </p>
      </section>
    </CompanyPage>
  );
}
