import { OrderDetailSkeleton } from "@/components/shop/order-detail-client";

export default function StoreTrackingLoading() {
  return (
    <div className="px-4 py-8 sm:px-6">
      <OrderDetailSkeleton />
    </div>
  );
}
