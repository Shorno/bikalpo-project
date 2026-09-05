import { notFound, redirect } from "next/navigation";
import { StoreItemRequests } from "@/components/storefront/store-item-requests";
import {
  isCustomerStorefrontPreview,
  withCustomerStorefrontPreview,
} from "@/lib/customer-storefront-preview";
import { getPublicStoreIdentity } from "@/lib/public-data";
import { checkAuth } from "@/utils/auth";

export const metadata = { title: "Store item requests" };
export default async function RequestsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string; request?: string }>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const root = `/stores/${encodeURIComponent(slug)}`;
  const preview = isCustomerStorefrontPreview(query.preview);
  const href = withCustomerStorefrontPreview(
    `${root}/requests${query.request === "new" ? "?request=new" : ""}`,
    preview,
  );
  const session = await checkAuth();
  if (!session?.user) redirect(`/login?redirect=${encodeURIComponent(href)}`);
  const shop = await getPublicStoreIdentity(slug);
  if (!shop) notFound();
  if (session.user.role !== "consumer")
    return (
      <p className="mx-auto max-w-3xl px-4 py-12">
        Sign in with a consumer account to request items from this store.
      </p>
    );
  return (
    <StoreItemRequests
      key={`${shop.id}-${session.user.id}`}
      shopId={shop.id}
      viewerId={session.user.id}
      name={shop.shopName || shop.name}
      storeHref={withCustomerStorefrontPreview(root, preview)}
      openInitially={query.request === "new"}
    />
  );
}
