"use client";

import { useMutation } from "@tanstack/react-query";
import { Loader2, ShoppingBag } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { orpc } from "@/utils/orpc";

interface ConvertOrderFormProps {
  estimateId: number;
  redirectPath?: string;
}

export function ConvertOrderForm({
  estimateId,
  redirectPath = "/account/orders",
}: ConvertOrderFormProps) {
  const router = useRouter();

  const mutation = useMutation({
    ...orpc.customer.convertEstimateToOrder.mutationOptions(),
    onSuccess: () => {
      toast.success("Order placed successfully!");
      router.push(redirectPath);
      router.refresh();
    },
    onError: (err) => {
      toast.error(err?.message || "Something went wrong");
    },
  });

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-4">
      <h3 className="text-base font-semibold leading-none tracking-tight mb-4">
        Accept & Place Order
      </h3>
      <Button
        type="button"
        className="w-full"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate({ estimateId })}
      >
        {mutation.isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <ShoppingBag className="mr-2 h-4 w-4" />
        )}
        Accept & Place Order
      </Button>
    </div>
  );
}
