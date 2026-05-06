import { AdminCatalogRequests } from "@/components/catalog-approval/admin-catalog-requests";
import BrandList from "@/components/features/brand/components/brand-list";

export default async function BrandPage() {
  return (
    <div className={"container mx-auto space-y-6"}>
      <h1 className="text-2xl font-bold mb-4">Brands</h1>
      <BrandList />
      <AdminCatalogRequests requestType="brand" title="Brand Requests" />
    </div>
  );
}
