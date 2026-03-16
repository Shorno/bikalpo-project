import { OrderDetailClient } from "@/components/shop/order-detail-client";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <OrderDetailClient orderNumber={id} />;
}
