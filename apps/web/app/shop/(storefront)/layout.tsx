import type { ReactNode } from "react";
import { Footer } from "@/components/layout/footer";
import { ShopNavbar } from "@/components/shop/layout/customer-navbar";

export default function StorefrontLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-[#f8f9fa]">
      <ShopNavbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
