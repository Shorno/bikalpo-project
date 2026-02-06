"use client";

import { useMutation } from "@tanstack/react-query";
import { Loader2, Navigation } from "lucide-react";
import { toast } from "sonner";
import { startDelivery } from "@/actions/delivery/deliveryman-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface StartDeliveryCardProps {
  groupId: number;
  onSuccess: () => void;
}

export function StartDeliveryCard({
  groupId,
  onSuccess,
}: StartDeliveryCardProps) {
  const startMutation = useMutation({
    mutationFn: () => startDelivery(groupId),
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Delivery run started successfully");
        onSuccess();
      } else {
        toast.error(result.error || "Failed to start delivery");
      }
    },
    onError: () => {
      toast.error("Something went wrong");
    },
  });

  return (
    <Card className="border-primary/50 bg-primary/5 p-0">
      <CardContent className="flex flex-col items-center justify-center p-4 sm:p-6 gap-3 sm:gap-4">
        <div className="text-center space-y-1 sm:space-y-2">
          <h3 className="font-semibold text-base sm:text-lg">
            Ready to start?
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Start the delivery run to begin processing orders.
          </p>
        </div>
        <Button
          size="default"
          onClick={() => startMutation.mutate()}
          disabled={startMutation.isPending}
          className="w-full sm:w-auto h-9 sm:h-10 text-sm"
        >
          {startMutation.isPending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          <Navigation className="mr-2 h-4 w-4" />
          Start Delivery Run
        </Button>
      </CardContent>
    </Card>
  );
}
