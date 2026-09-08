"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { subscriptionMoney } from "@/components/features/settings/retailer-subscription";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { client, orpc } from "@/utils/orpc";

type Plan = Awaited<
  ReturnType<typeof client.adminRetailerSubscription.listPlans>
>[number];

export function RetailerSubscriptionsManagement() {
  const queryClient = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery(
    orpc.adminRetailerSubscription.listPlans.queryOptions(),
  );
  const [editing, setEditing] = useState<Plan | null | undefined>(undefined);
  const [formError, setFormError] = useState("");
  const mutation = useMutation({
    mutationFn: async (form: FormData) => {
      const duration = form.get("duration");
      const input = {
        code: String(form.get("code")),
        name: String(form.get("name")),
        description: String(form.get("description")),
        durationMonths:
          duration === "free" ? null : (Number(duration) as 1 | 6 | 12),
        amountMinor: Math.round(Number(form.get("amount")) * 100),
        active: form.get("active") === "on",
        sortOrder: Number(form.get("sortOrder")),
      };
      return editing
        ? client.adminRetailerSubscription.updatePlan({
            id: editing.id,
            version: editing.version,
            data: input,
          })
        : client.adminRetailerSubscription.createPlan(input);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: orpc.adminRetailerSubscription.listPlans.key(),
      });
      setEditing(undefined);
      toast.success("Subscription plan saved");
    },
    onError: (err) => setFormError(err.message),
  });
  const openEditor = (plan: Plan | null) => {
    setFormError("");
    setEditing(plan);
  };
  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Retailer Subscriptions
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage the plans available in the retailer subscription modal.
            Payments are simulated.
          </p>
        </div>
        <Button onClick={() => openEditor(null)}>
          <Plus className="size-4" />
          Create plan
        </Button>
      </div>
      <p className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
        Longer terms must have a lower monthly cost. One active offer is allowed
        per duration. Deactivate an old offer before activating its replacement;
        purchased terms stay unchanged.
      </p>
      {isLoading ? (
        <Skeleton className="h-56 w-full" />
      ) : error ? (
        <div role="alert">
          <p>{error.message}</p>
          <Button variant="outline" onClick={() => void refetch()}>
            Retry
          </Button>
        </div>
      ) : !data?.length ? (
        <p className="rounded-xl border p-8 text-center text-muted-foreground">
          No subscription plans have been seeded yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                {[
                  "Plan",
                  "Duration",
                  "Total price",
                  "Per month",
                  "Status",
                  "",
                ].map((heading) => (
                  <th
                    key={heading}
                    className="whitespace-nowrap p-4 font-medium"
                  >
                    {heading || <span className="sr-only">Actions</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((plan) => (
                <tr key={plan.id} className="border-b last:border-0">
                  <td className="p-4">
                    <p className="font-medium">{plan.name}</p>
                    <p className="text-xs text-muted-foreground">{plan.code}</p>
                  </td>
                  <td className="whitespace-nowrap p-4">
                    {plan.durationMonths
                      ? `${plan.durationMonths} months`
                      : "No expiry"}
                  </td>
                  <td className="whitespace-nowrap p-4 tabular-nums">
                    {subscriptionMoney(plan.amountMinor)}
                  </td>
                  <td className="whitespace-nowrap p-4 tabular-nums">
                    {subscriptionMoney(
                      plan.durationMonths
                        ? plan.amountMinor / plan.durationMonths
                        : 0,
                    )}
                  </td>
                  <td className="p-4">
                    <span
                      className={
                        plan.active
                          ? "text-emerald-700"
                          : "text-muted-foreground"
                      }
                    >
                      {plan.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="p-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditor(plan)}
                      aria-label={`Edit ${plan.name}`}
                    >
                      Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Dialog
        open={editing !== undefined}
        onOpenChange={(open) => {
          if (!open && !mutation.isPending) setEditing(undefined);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit subscription plan" : "Create subscription plan"}
            </DialogTitle>
            <DialogDescription>
              Enter the total price for the full term in BDT. Codes and
              durations are fixed after creation.
            </DialogDescription>
          </DialogHeader>
          <form
            key={editing?.id || "new"}
            onSubmit={(event) => {
              event.preventDefault();
              setFormError("");
              mutation.mutate(new FormData(event.currentTarget));
            }}
            className="space-y-4"
          >
            {formError && (
              <p role="alert" className="text-sm text-red-600">
                {formError}
              </p>
            )}
            <fieldset disabled={mutation.isPending} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="subscription-code">Code</Label>
                <Input
                  id="subscription-code"
                  name="code"
                  defaultValue={editing?.code || ""}
                  readOnly={Boolean(editing)}
                  required
                  pattern="[a-z][a-z0-9_]*"
                  minLength={2}
                  maxLength={60}
                  placeholder="summer_monthly"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subscription-name">Plan name</Label>
                <Input
                  id="subscription-name"
                  name="name"
                  defaultValue={editing?.name || ""}
                  required
                  minLength={2}
                  maxLength={100}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subscription-description">Description</Label>
                <Input
                  id="subscription-description"
                  name="description"
                  defaultValue={editing?.description || ""}
                  maxLength={500}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="subscription-duration">Duration</Label>
                  {editing ? (
                    <>
                      <Input
                        id="subscription-duration"
                        value={
                          editing.durationMonths
                            ? `${editing.durationMonths} months`
                            : "No expiry"
                        }
                        readOnly
                      />
                      <input
                        type="hidden"
                        name="duration"
                        value={editing.durationMonths ?? "free"}
                      />
                    </>
                  ) : (
                    <select
                      id="subscription-duration"
                      name="duration"
                      className="h-9 w-full rounded-md border bg-background px-3"
                    >
                      <option value="1">Monthly</option>
                      <option value="6">Six-monthly</option>
                      <option value="12">Yearly</option>
                    </select>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subscription-amount">Total price (BDT)</Label>
                  <Input
                    id="subscription-amount"
                    name="amount"
                    type="number"
                    min={editing?.code === "free" ? 0 : 0.01}
                    max={1000000}
                    step="0.01"
                    required
                    defaultValue={editing ? editing.amountMinor / 100 : ""}
                    readOnly={editing?.code === "free"}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="subscription-order">Display order</Label>
                <Input
                  id="subscription-order"
                  name="sortOrder"
                  type="number"
                  min={0}
                  max={1000}
                  step={1}
                  defaultValue={editing?.sortOrder ?? 4}
                  required
                />
              </div>
              {editing?.code === "free" ? (
                <>
                  <input type="hidden" name="active" value="on" />
                  <p className="text-sm text-muted-foreground">
                    Free stays active as the default subscription.
                  </p>
                </>
              ) : (
                <label className="flex items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    name="active"
                    defaultChecked={editing?.active ?? false}
                    className="size-4"
                  />
                  Available for purchase
                </label>
              )}
            </fieldset>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={mutation.isPending}
                onClick={() => setEditing(undefined)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                Save plan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
