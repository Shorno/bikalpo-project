import type { Metadata } from "next";
import { Suspense } from "react";
import { SellerDirectory } from "@/components/features/landing/seller-directory";

export const metadata: Metadata = {
  title: { absolute: "Sellers | Bikalpo" },
  description: "Explore Bikalpo sellers by their registered business location.",
};
export default function SellersPage() {
  return (
    <Suspense
      fallback={
        <p role="status" className="px-6 py-12">
          Loading sellers…
        </p>
      }
    >
      <SellerDirectory />
    </Suspense>
  );
}
