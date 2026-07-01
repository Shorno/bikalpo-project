import { redirect } from "next/navigation";

export default async function WarehouseOrderRedirectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  redirect(
    `/dashboard/order-from-warehouse?warehouse=${encodeURIComponent(slug)}`,
  );
}
