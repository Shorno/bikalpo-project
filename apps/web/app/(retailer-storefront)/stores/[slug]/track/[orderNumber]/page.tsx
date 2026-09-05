import { notFound, redirect } from "next/navigation";
import { OrderDetailClient } from "@/components/shop/order-detail-client";
import {
  isCustomerStorefrontPreview,
  withCustomerStorefrontPreview,
} from "@/lib/customer-storefront-preview";
import { getPublicStoreIdentity } from "@/lib/public-data";
import { checkAuth } from "@/utils/auth";

export const metadata = { title: "Order tracking" };

export default async function StoreOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; orderNumber: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const [{ slug, orderNumber }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  const preview = isCustomerStorefrontPreview(query.preview);
  const root = `/stores/${encodeURIComponent(slug)}`;
  const href = withCustomerStorefrontPreview(
    `${root}/track/${encodeURIComponent(orderNumber)}`,
    preview,
  );
  const session = await checkAuth();
  if (!session?.user) redirect(`/login?redirect=${encodeURIComponent(href)}`);
  const shop = await getPublicStoreIdentity(slug);
  if (!shop) notFound();
  return (
    <div className="px-4 py-8 sm:px-6">
      <OrderDetailClient
        key={`${shop.id}-${session.user.id}-${orderNumber}`}
        orderNumber={orderNumber}
        store={{
          shopId: shop.id,
          viewerId: session.user.id,
          name: shop.shopName || shop.name,
          backHref: withCustomerStorefrontPreview(root, preview),
        }}
      />
    </div>
  );
}
