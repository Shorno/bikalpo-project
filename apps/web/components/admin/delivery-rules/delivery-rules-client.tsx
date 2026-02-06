"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2, Truck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { createDeliveryRule } from "@/actions/delivery-rule/create-delivery-rule";
import { deleteDeliveryRule } from "@/actions/delivery-rule/delete-delivery-rule";
import { listDeliveryRules } from "@/actions/delivery-rule/list-delivery-rules";
import { updateDeliveryRule } from "@/actions/delivery-rule/update-delivery-rule";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { DeliveryRule } from "@/db/schema/delivery-rule";

export function DeliveryRulesClient() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DeliveryRule | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: rules = [] } = useQuery({
    queryKey: ["delivery-rules"],
    queryFn: listDeliveryRules,
  });

  const handleAdd = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const handleEdit = (r: DeliveryRule) => {
    setEditing(r);
    setDialogOpen(true);
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) setEditing(null);
    queryClient.invalidateQueries({ queryKey: ["delivery-rules"] });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);

    const name = (fd.get("name") as string)?.trim() || undefined;
    const area = (fd.get("area") as string)?.trim() || undefined;
    const minWeightKg = (fd.get("minWeightKg") as string)?.trim() || undefined;
    const maxWeightKg = (fd.get("maxWeightKg") as string)?.trim() || undefined;
    const baseCost = (fd.get("baseCost") as string)?.trim() || "0";
    const perKgCost = (fd.get("perKgCost") as string)?.trim() || "0";
    const isActive = fd.get("isActive") === "on";
    const sortOrder = fd.get("sortOrder") ? Number(fd.get("sortOrder")) : 0;
    const note = (fd.get("note") as string)?.trim() || undefined;

    try {
      if (editing) {
        await updateDeliveryRule({
          id: editing.id,
          name,
          area,
          minWeightKg,
          maxWeightKg,
          baseCost,
          perKgCost,
          isActive,
          sortOrder,
          note,
        });
        toast.success("Rule updated");
      } else {
        await createDeliveryRule({
          name,
          area,
          minWeightKg,
          maxWeightKg,
          baseCost,
          perKgCost,
          isActive,
          sortOrder,
          note,
        });
        toast.success("Rule added");
      }
      handleDialogClose(false);
    } catch {
      toast.error(editing ? "Failed to update rule" : "Failed to add rule");
    }
  };

  const handleDeleteConfirm = async () => {
    if (deleteId == null) return;
    try {
      await deleteDeliveryRule(deleteId);
      toast.success("Rule removed");
      queryClient.invalidateQueries({ queryKey: ["delivery-rules"] });
    } catch {
      toast.error("Failed to remove rule");
    }
    setDeleteId(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Delivery rules</h1>
        <p className="text-muted-foreground">
          Configure delivery cost by area and order weight. Used at checkout.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Truck className="h-4 w-4" />
                Rules
              </CardTitle>
              <CardDescription>
                First matching rule (area + weight band) is used. Cost = base +
                (per kg × weight).
              </CardDescription>
            </div>
            <Button type="button" size="sm" onClick={handleAdd}>
              <Plus className="mr-2 h-4 w-4" />
              Add rule
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {rules.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6">
              No rules yet. Add one to set delivery cost by area and weight.
            </p>
          ) : (
            <ul className="space-y-2">
              {rules.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between rounded-lg border p-3 text-sm"
                >
                  <div>
                    <span className="font-medium">{r.name || "Unnamed"}</span>
                    {!r.isActive && (
                      <Badge variant="secondary" className="ml-2">
                        Inactive
                      </Badge>
                    )}
                    <div className="text-muted-foreground mt-0.5">
                      {r.area ? `Area: ${r.area}` : "All areas"} · Weight:{" "}
                      {r.minWeightKg ?? 0}–{r.maxWeightKg ?? "∞"} kg · Base ৳
                      {r.baseCost} + ৳{r.perKgCost}/kg
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(r)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteId(r.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit rule" : "Add rule"}</DialogTitle>
          </DialogHeader>
          <form
            id="delivery-rule-form"
            onSubmit={handleSubmit}
            className="space-y-4"
          >
            <Field>
              <FieldLabel>Name</FieldLabel>
              <Input
                name="name"
                defaultValue={editing?.name ?? ""}
                placeholder="e.g. Standard"
              />
            </Field>
            <Field>
              <FieldLabel>Area (optional)</FieldLabel>
              <Input
                name="area"
                defaultValue={editing?.area ?? ""}
                placeholder="Leave empty for all areas"
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel>Min weight (kg)</FieldLabel>
                <Input
                  name="minWeightKg"
                  type="text"
                  defaultValue={editing?.minWeightKg ?? ""}
                  placeholder="0"
                />
              </Field>
              <Field>
                <FieldLabel>Max weight (kg)</FieldLabel>
                <Input
                  name="maxWeightKg"
                  type="text"
                  defaultValue={editing?.maxWeightKg ?? ""}
                  placeholder="∞"
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel>Base cost (৳)</FieldLabel>
                <Input
                  name="baseCost"
                  type="text"
                  defaultValue={editing?.baseCost ?? "0"}
                  placeholder="0"
                />
              </Field>
              <Field>
                <FieldLabel>Per kg cost (৳)</FieldLabel>
                <Input
                  name="perKgCost"
                  type="text"
                  defaultValue={editing?.perKgCost ?? "0"}
                  placeholder="0"
                />
              </Field>
            </div>
            <Field>
              <FieldLabel>Sort order</FieldLabel>
              <Input
                name="sortOrder"
                type="number"
                defaultValue={editing?.sortOrder ?? 0}
              />
            </Field>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                name="isActive"
                id="isActive"
                defaultChecked={editing?.isActive ?? true}
                className="h-4 w-4 rounded border-input"
              />
              <Label htmlFor="isActive">Active</Label>
            </div>
            <Field>
              <FieldLabel>Note</FieldLabel>
              <Textarea
                name="note"
                defaultValue={editing?.note ?? ""}
                rows={2}
              />
            </Field>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleDialogClose(false)}
              >
                Cancel
              </Button>
              <Button type="submit" form="delivery-rule-form">
                {editing ? "Update" : "Add"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteId != null}
        onOpenChange={(o) => !o && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove rule?</AlertDialogTitle>
            <AlertDialogDescription>
              This delivery rule will be removed. Checkout may use a different
              rule or no cost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
