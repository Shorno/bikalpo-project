import { OrderConfirmationClient } from "@/components/shop/order-confirmation-client";

interface OrderConfirmationPageProps {
  params: Promise<{ orderNumber: string }>;
}

export default async function CustomerOrderConfirmationPage({
  params,
}: OrderConfirmationPageProps) {
  const { orderNumber } = await params;

  return <OrderConfirmationClient orderNumber={orderNumber} />;
}
