import { notFound } from "next/navigation";
import AdminOrderDetailsClient from "@/components/features/orders/admin-order-details";

export default async function AdminOrderDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const orderId = Number(id);

  if (Number.isNaN(orderId)) {
    notFound();
  }

  return <AdminOrderDetailsClient orderId={orderId} />;
}
