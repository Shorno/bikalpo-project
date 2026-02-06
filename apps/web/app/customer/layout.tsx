import type { ReactNode } from "react";
import { CustomerNavbar } from "@/components/customer/layout/customer-navbar";
import { Footer } from "@/components/layout/footer";

export default async function CustomerLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-[#f8f9fa]">
      <CustomerNavbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
