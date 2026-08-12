"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader, Package } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import {
  type CategoryOption,
  EMPTY_VARIANT_DRAFT,
  isVariantDraftComplete,
  type ProductTypeOption,
  VariantDefinitionEditor,
  type VariantDraft,
  variantDraftToPayload,
} from "@/components/features/variant-option/components/variant-definition-editor";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { client, orpc } from "@/utils/orpc";

export function VariantRequestModal({
  options,
  open: controlledOpen,
  onOpenChange,
}: {
  options?: {
    types?: ProductTypeOption[];
    categories?: CategoryOption[];
  };
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<VariantDraft>({
    ...EMPTY_VARIANT_DRAFT,
  });
  const queryClient = useQueryClient();
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;

  const mutation = useMutation({
    mutationFn: () =>
      client.catalogRequest.createRequest({
        requestType: "variant_option",
        payload: variantDraftToPayload(draft),
      }),
    onSuccess: async (result) => {
      toast.success(result.message || "Variant request submitted");
      await queryClient.invalidateQueries({
        queryKey: orpc.catalogRequest.getMyRequests.key(),
      });
      setDraft({ ...EMPTY_VARIANT_DRAFT });
      setOpen(false);
    },
    onError: (error) => toast.error(error.message || "Request failed"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Package className="h-4 w-4" />
          New Variant
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Request a Variant Option</DialogTitle>
          <DialogDescription>
            Define one reusable variant exactly as Admin does. Its canonical
            name and inventory behavior are generated from this definition.
          </DialogDescription>
        </DialogHeader>
        <VariantDefinitionEditor
          value={draft}
          onChange={setDraft}
          types={options?.types ?? []}
          categories={options?.categories ?? []}
        />
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !isVariantDraftComplete(draft)}
          >
            {mutation.isPending && (
              <Loader className="mr-2 h-4 w-4 animate-spin" />
            )}
            Submit Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
