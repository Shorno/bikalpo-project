import { notFound, redirect } from "next/navigation";
import { StoreOrderTracking } from "@/components/storefront/store-order-tracking";
import {
  isCustomerStorefrontPreview,
  withCustomerStorefrontPreview,
} from "@/lib/customer-storefront-preview";
import { getPublicStoreIdentity } from "@/lib/public-data";
import { checkAuth } from "@/utils/auth";

export const metadata = { title: "Track store orders" };

export default async function StoreTrackingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const preview = isCustomerStorefrontPreview(query.preview);
  const storeHref = withCustomerStorefrontPreview(
    `/stores/${encodeURIComponent(slug)}`,
    preview,
  );
  const trackingHref = withCustomerStorefrontPreview(
    `/stores/${encodeURIComponent(slug)}/track`,
    preview,
  );
  const session = await checkAuth();
  if (!session?.user)
    redirect(`/login?redirect=${encodeURIComponent(trackingHref)}`);
  const shop = await getPublicStoreIdentity(slug);
  if (!shop) notFound();
  return (
    <StoreOrderTracking
      key={`${shop.id}-${session.user.id}`}
      shopId={shop.id}
      viewerId={session.user.id}
      name={shop.shopName || shop.name}
      storeHref={storeHref}
      trackingHref={trackingHref}
    />
  );
}
