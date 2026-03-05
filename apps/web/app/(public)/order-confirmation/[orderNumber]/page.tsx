import { OrderDetailClient } from "@/components/shop/order-detail-client";

interface OrderConfirmationPageProps {
    params: Promise<{ orderNumber: string }>;
}

export default async function OrderConfirmationPage({
    params,
}: OrderConfirmationPageProps) {
    const { orderNumber } = await params;

    return <OrderDetailClient orderNumber={orderNumber} />;
}
