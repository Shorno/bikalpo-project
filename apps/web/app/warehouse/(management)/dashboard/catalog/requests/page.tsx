"use client";

import { CatalogRequestsPage } from "@/components/catalog-approval/catalog-requests-page";
import BrandRequestModal from "./_components/brand-request-modal";
import CoreProductRequestModal from "./_components/core-product-request-modal";

export default function WarehouseCatalogRequestsPage() {
  return (
    <CatalogRequestsPage
      extraActions={
        <>
          <BrandRequestModal />
          <CoreProductRequestModal />
        </>
      }
    />
  );
}
