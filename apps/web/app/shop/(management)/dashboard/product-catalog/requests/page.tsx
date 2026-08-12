import { CatalogRequestsPage } from "@/components/catalog-approval/catalog-requests-page";

export default async function ShopOwnerCatalogRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const query = await searchParams;
  return (
    <CatalogRequestsPage initialVariantOpen={query.new === "variant_option"} />
  );
}
