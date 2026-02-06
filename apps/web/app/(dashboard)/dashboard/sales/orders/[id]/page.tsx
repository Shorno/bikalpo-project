import { notFound } from "next/navigation";
import { SalesOrderDetails } from "@/components/features/orders/sales-order-details";

export default async function SalesOrderDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const orderId = Number(id);

  if (Number.isNaN(orderId)) {
    notFound();
  }

  return <SalesOrderDetails orderId={orderId} />;
}
