import { notFound } from "next/navigation";
import { getDeliverymanById } from "@/actions/admin/deliveryman-actions";
import { DeliverymanDetailClient } from "./deliveryman-detail-client";

interface DeliverymanDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function DeliverymanDetailPage({
  params,
}: DeliverymanDetailPageProps) {
  const { id } = await params;
  const result = await getDeliverymanById(id);

  if (!result.success || !result.deliveryman) {
    notFound();
  }

  return (
    <DeliverymanDetailClient
      deliverymanId={id}
      initialData={result.deliveryman}
    />
  );
}
