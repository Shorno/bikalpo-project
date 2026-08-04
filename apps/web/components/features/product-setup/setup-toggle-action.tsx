"use client";

import { useMutation } from "@tanstack/react-query";
import { LoaderCircle, Power } from "lucide-react";
import { toast } from "sonner";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

export function SetupToggleAction({
  isActive,
  mutationFn,
  onSuccess,
}: {
  isActive: boolean;
  mutationFn: () => Promise<{ message: string }>;
  onSuccess: () => void | Promise<void>;
}) {
  const mutation = useMutation({
    mutationFn,
    onSuccess: async (result) => {
      toast.success(result.message);
      await onSuccess();
    },
    onError: (error) => toast.error(error.message || "Status update failed"),
  });

  return (
    <DropdownMenuItem
      disabled={mutation.isPending}
      onSelect={() => mutation.mutate()}
    >
      {mutation.isPending ? (
        <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
      ) : (
        <Power aria-hidden="true" className="size-4" />
      )}
      {isActive ? "Disable" : "Enable"}
    </DropdownMenuItem>
  );
}
