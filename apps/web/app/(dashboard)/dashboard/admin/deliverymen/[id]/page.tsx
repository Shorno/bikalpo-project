import { notFound } from "next/navigation";
import { client } from "@/utils/orpc";
import { DeliverymanDetailClient } from "./deliveryman-detail-client";

interface DeliverymanDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function DeliverymanDetailPage({
  params,
}: DeliverymanDetailPageProps) {
  const { id } = await params;
  let deliveryman;
  try {
    const result = await client.deliveryman.getById({ id });
    deliveryman = result.deliveryman;
  } catch {
    notFound();
  }

  if (!deliveryman) {
    notFound();
  }

  return (
    <DeliverymanDetailClient deliverymanId={id} initialData={deliveryman} />
  );
}
