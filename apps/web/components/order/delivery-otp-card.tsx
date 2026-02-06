"use client";

import { useQuery } from "@tanstack/react-query";
import { KeyRound } from "lucide-react";
import { getOrderDeliveryOtp } from "@/actions/order/order-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DeliveryOtpCardProps {
  orderId: number;
}

export function DeliveryOtpCard({ orderId }: DeliveryOtpCardProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["delivery-otp", orderId],
    queryFn: () => getOrderDeliveryOtp(orderId),
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 10000,
  });

  if (isLoading || !data?.showOtp || !data?.otp) {
    return null;
  }

  return (
    <Card className="border-primary/50 bg-primary/5 mb-6">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg text-primary">
          <KeyRound className="h-5 w-5" />
          Delivery OTP
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-3">
          Share this code with the delivery person to confirm your order.
        </p>
        <div className="flex items-center justify-center bg-background rounded-lg py-4 border-2 border-dashed border-primary/30">
          <span className="text-4xl font-bold tracking-[0.5em] font-mono">
            {data.otp}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-3 text-center">
          Do not share this code until you receive your order
        </p>
      </CardContent>
    </Card>
  );
}
