import type { Metadata } from "next";
import { CompanyPage } from "@/components/features/landing/company-page";

export const metadata: Metadata = {
  title: { absolute: "Privacy Policy | Bikalpo" },
  description:
    "An overview of the topics the Bikalpo privacy policy will cover.",
};

export default function Page() {
  return (
    <CompanyPage
      title="Privacy Policy"
      intro="An overview of the topics the Bikalpo privacy policy will cover."
    >
      <section>
        <h2>Account and order information</h2>
        <p>
          The final policy will describe what information is collected when you
          create an account, browse the platform, or place an order.
        </p>
      </section>
      <section>
        <h2>Data use and your choices</h2>
        <p>
          Details about storage, sharing, retention, and privacy requests are
          being prepared. This draft does not define the final privacy
          practices.
        </p>
      </section>
    </CompanyPage>
  );
}
