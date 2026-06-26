import { ReturnProcessingForm } from "@/components/features/returns/return-processing-form";

interface ReturnProcessingPageProps {
  params: Promise<{ orderId: string }>;
}

export default async function ReturnProcessingPage({
  params,
}: ReturnProcessingPageProps) {
  const { orderId } = await params;
  const orderIdNum = parseInt(orderId, 10);

  if (Number.isNaN(orderIdNum)) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Invalid order ID</p>
      </div>
    );
  }

  return <ReturnProcessingForm orderId={orderIdNum} />;
}
