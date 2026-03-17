"use client";

import type { ProductVariant } from "@bikalpo-project/db/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Link2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { client } from "@/utils/orpc";

type ConversionRule = {
  id: number;
  fromVariantId: number;
  toVariantId: number;
  conversionRatio: string;
  autoConvert: boolean;
  fromVariant?: ProductVariant;
  toVariant?: ProductVariant;
};

function variantLabel(v?: ProductVariant | null) {
  if (!v) return "Unknown";
  const type =
    v.variantType === "trade"
      ? "Trade"
      : v.variantType === "retail"
        ? "Retail"
        : "";
  return `${v.quantitySelectorLabel || v.unitLabel} ${v.weightKg}kg${type ? ` (${type})` : ""}`;
}

export function VariantConversionPanel({
  productId,
  variants,
}: {
  productId: number;
  variants: ProductVariant[];
}) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const [fromVariantId, setFromVariantId] = useState<string>("");
  const [toVariantId, setToVariantId] = useState<string>("");
  const [ratio, setRatio] = useState("1");
  const [autoConvert, setAutoConvert] = useState(true);

  const { data: rules = [] } = useQuery<ConversionRule[]>({
    queryKey: ["conversion-rules", productId],
    queryFn: () => {
      // Get rules for all variants of this product
      const variantIds = variants.map((v) => v.id);
      if (variantIds.length === 0) return [];
      // Fetch all rules and filter client-side (API supports single fromVariantId filter)
      return client.adminProductVariant
        .listConversionRules({})
        .then((allRules: ConversionRule[]) =>
          allRules.filter(
            (r) =>
              variantIds.includes(r.fromVariantId) ||
              variantIds.includes(r.toVariantId),
          ),
        );
    },
    enabled: variants.length > 0,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      client.adminProductVariant.createConversionRule({
        fromVariantId: parseInt(fromVariantId, 10),
        toVariantId: parseInt(toVariantId, 10),
        conversionRatio: ratio,
        autoConvert,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["conversion-rules", productId],
      });
      toast.success("Conversion rule added");
      setDialogOpen(false);
      resetForm();
    },
    onError: () => toast.error("Failed to add conversion rule"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      client.adminProductVariant.deleteConversionRule({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["conversion-rules", productId],
      });
      toast.success("Conversion rule removed");
      setDeleteId(null);
    },
    onError: () => toast.error("Failed to remove conversion rule"),
  });

  const resetForm = () => {
    setFromVariantId("");
    setToVariantId("");
    setRatio("1");
    setAutoConvert(true);
  };

  const tradeVariants = variants.filter((v) => v.variantType === "trade");
  const retailVariants = variants.filter((v) => v.variantType === "retail");
  const hasTypedVariants =
    tradeVariants.length > 0 && retailVariants.length > 0;

  if (variants.length < 2) return null;

  return (
    <>
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Link2 className="size-4" />
                Conversion Rules
              </CardTitle>
              <CardDescription>
                Link Trade (B2B) variants to Retail (B2C) variants for
                auto-conversion (e.g. 1 Carton → 10 Packs)
              </CardDescription>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => setDialogOpen(true)}
              disabled={!hasTypedVariants}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Rule
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!hasTypedVariants ? (
            <div className="flex flex-col items-center justify-center py-6 text-center border rounded-lg bg-muted/30">
              <Link2 className="size-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Set at least one variant as <strong>Trade</strong> and one as{" "}
                <strong>Retail</strong> to create conversion rules.
              </p>
            </div>
          ) : rules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center border rounded-lg bg-muted/30">
              <Link2 className="size-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                No conversion rules yet. Add one to link Trade → Retail
                variants.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {rules.map((rule) => {
                const from =
                  variants.find((v) => v.id === rule.fromVariantId) ??
                  rule.fromVariant;
                const to =
                  variants.find((v) => v.id === rule.toVariantId) ??
                  rule.toVariant;
                return (
                  <div
                    key={rule.id}
                    className="flex items-center justify-between rounded-lg border p-3 text-sm gap-3"
                  >
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <Badge variant="default" className="text-xs shrink-0">
                        Trade
                      </Badge>
                      <span className="font-medium truncate">
                        {variantLabel(from as ProductVariant | undefined)}
                      </span>
                      <ArrowRight className="size-4 text-muted-foreground shrink-0" />
                      <Badge variant="secondary" className="text-xs shrink-0">
                        Retail
                      </Badge>
                      <span className="font-medium truncate">
                        {variantLabel(to as ProductVariant | undefined)}
                      </span>
                      <span className="text-muted-foreground">
                        × {rule.conversionRatio}
                      </span>
                      {rule.autoConvert && (
                        <Badge
                          variant="outline"
                          className="text-[10px] h-5 text-green-600 border-green-300"
                        >
                          Auto
                        </Badge>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0"
                      onClick={() => setDeleteId(rule.id)}
                    >
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Rule Dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) resetForm();
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Conversion Rule</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Field>
              <FieldLabel>From (Trade Variant)</FieldLabel>
              <Select value={fromVariantId} onValueChange={setFromVariantId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select trade variant" />
                </SelectTrigger>
                <SelectContent>
                  {tradeVariants.map((v) => (
                    <SelectItem key={v.id} value={v.id.toString()}>
                      {variantLabel(v)}
                      {v.sku ? ` (${v.sku})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>To (Retail Variant)</FieldLabel>
              <Select value={toVariantId} onValueChange={setToVariantId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select retail variant" />
                </SelectTrigger>
                <SelectContent>
                  {retailVariants.map((v) => (
                    <SelectItem key={v.id} value={v.id.toString()}>
                      {variantLabel(v)}
                      {v.sku ? ` (${v.sku})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>
                Conversion Ratio (1 trade unit = X retail units)
              </FieldLabel>
              <Input
                type="text"
                value={ratio}
                onChange={(e) => setRatio(e.target.value)}
                placeholder="e.g. 10"
              />
            </Field>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Auto Convert</p>
                <p className="text-xs text-muted-foreground">
                  Automatically convert inventory on B2B purchase
                </p>
              </div>
              <Switch checked={autoConvert} onCheckedChange={setAutoConvert} />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={
                !fromVariantId ||
                !toVariantId ||
                !ratio ||
                createMutation.isPending
              }
            >
              {createMutation.isPending ? "Saving…" : "Add Rule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={deleteId != null}
        onOpenChange={(o) => !o && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove conversion rule?</AlertDialogTitle>
            <AlertDialogDescription>
              This conversion rule will be deleted. Inventory auto-conversion
              for this link will stop.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
