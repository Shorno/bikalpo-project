"use client";

import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader, Tags } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
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
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { generateSlug } from "@/utils/generate-slug";
import { orpc } from "@/utils/orpc";

export default function BrandRequestModal() {
  const [open, setOpen] = React.useState(false);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (payload: any) =>
      orpc.catalogRequest.createRequest.call({
        requestType: "brand" as const,
        payload,
      }),
    onSuccess: async (result) => {
      toast.success(result.message || "Brand request submitted");
      await queryClient.invalidateQueries({
        queryKey: orpc.catalogRequest.getMyRequests.key(),
      });
      form.reset();
      setOpen(false);
    },
    onError: (error: any) => toast.error(error.message || "Request failed"),
  });

  const form = useForm({
    defaultValues: { name: "", slug: "" },
    onSubmit: async ({ value }) => mutation.mutate(value),
  });

  const autoSlug = (v: string) => form.setFieldValue("slug", generateSlug(v));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Tags className="h-4 w-4" />
          New Brand
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Request a Brand</DialogTitle>
          <DialogDescription>
            Submit a new brand for admin approval.
          </DialogDescription>
        </DialogHeader>
        <form
          id="brand-request-form"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          className="space-y-4"
        >
          <form.Field name="name">
            {(field) => {
              const isInvalid =
                field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>Brand Name *</FieldLabel>
                  <Input
                    id={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => {
                      field.handleChange(e.target.value);
                      autoSlug(e.target.value);
                    }}
                    placeholder="Unilever"
                    autoComplete="off"
                  />
                  {isInvalid && <FieldError errors={field.state.meta.errors} />}
                </Field>
              );
            }}
          </form.Field>

          <form.Field name="slug">
            {(field) => {
              const isInvalid =
                field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>Slug *</FieldLabel>
                  <Input
                    id={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="unilever"
                    autoComplete="off"
                  />
                  <FieldDescription>
                    URL-friendly version of the name.
                  </FieldDescription>
                  {isInvalid && <FieldError errors={field.state.meta.errors} />}
                </Field>
              );
            }}
          </form.Field>
        </form>
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
            type="submit"
            form="brand-request-form"
            disabled={mutation.isPending}
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
