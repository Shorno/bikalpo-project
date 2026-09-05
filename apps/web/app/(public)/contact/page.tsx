import type { Metadata } from "next";
import { CompanyPage } from "@/components/features/landing/company-page";

export const metadata: Metadata = {
  title: { absolute: "Contact Us | Bikalpo" },
  description:
    "Get in touch with the Bikalpo team. The details below are placeholders.",
};

export default function Page() {
  return (
    <CompanyPage
      title="Contact Us"
      intro="Get in touch with the Bikalpo team. The details below are placeholders."
    >
      <section>
        <h2>Email</h2>
        <p>support@bikalpo.com</p>
      </section>
      <section>
        <h2>Phone</h2>
        <p>+880 1XXX-XXXXXX</p>
      </section>
      <section>
        <h2>Address and hours</h2>
        <p>Dhaka, Bangladesh. Sat–Thu, 9:00 AM – 8:00 PM.</p>
      </section>
    </CompanyPage>
  );
}
