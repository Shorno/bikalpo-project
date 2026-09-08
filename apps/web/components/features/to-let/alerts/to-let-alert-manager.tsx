"use client";

import { Bell, CheckCircle2, Loader2, Pause, Play, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  alertsFromResponse,
  type ToLetAlertCategory,
  toLetAlertCategoryOptions,
  useCreateToLetAlert,
  useDeleteToLetAlert,
  useMyToLetAlerts,
  useUpdateToLetAlertStatus,
} from "@/hooks/use-to-let-rental-api";
import { authClient } from "@/lib/auth-client";
import type { ToLetMarketRentalType } from "@/lib/to-let-marketplace";

interface ToLetAlertManagerProps {
  query?: string;
  selectedType?: ToLetMarketRentalType;
  onClose?: () => void;
}

function integerValue(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function categoryLabel(value: string) {
  return (
    toLetAlertCategoryOptions.find((option) => option.value === value)?.label ??
    value
  );
}

export function ToLetAlertManager({
  query = "",
  selectedType,
  onClose,
}: ToLetAlertManagerProps) {
  const { data: session, isPending: isSessionPending } =
    authClient.useSession();
  const [isHydrated, setIsHydrated] = useState(false);
  const [saved, setSaved] = useState(false);
  const [preferredCategory, setPreferredCategory] =
    useState<ToLetAlertCategory>(selectedType ?? "any");
  const [preferredLocation, setPreferredLocation] = useState(
    query || "Any location",
  );
  const [minimumSizeSqFt, setMinimumSizeSqFt] = useState("0");
  const [minimumBedrooms, setMinimumBedrooms] = useState("0");
  const [minimumBathrooms, setMinimumBathrooms] = useState("0");
  const [minimumBalconies, setMinimumBalconies] = useState("0");
  const [balconyPreference, setBalconyPreference] = useState<
    "required" | "optional" | "not_required"
  >("optional");
  const [preferredFloor, setPreferredFloor] = useState("any");

  const role = (session?.user as { role?: string | null } | undefined)?.role;
  const isConsumer = role === "consumer";
  const alertsQuery = useMyToLetAlerts(isHydrated && isConsumer);
  const createAlert = useCreateToLetAlert();
  const updateStatus = useUpdateToLetAlertStatus();
  const deleteAlert = useDeleteToLetAlert();
  const alerts = alertsFromResponse(alertsQuery.data);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    setPreferredCategory(selectedType ?? "any");
    setPreferredLocation(query || "Any location");
    setSaved(false);
  }, [query, selectedType]);

  const saveAlert = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const location = preferredLocation.trim();
    if (location.length < 2) {
      toast.error("Enter a preferred location");
      return;
    }

    try {
      await createAlert.mutateAsync({
        preferredCategory,
        preferredLocation: location,
        minimumSizeSqFt: integerValue(minimumSizeSqFt),
        minimumBedrooms: integerValue(minimumBedrooms),
        minimumBathrooms: integerValue(minimumBathrooms),
        minimumBalconies: integerValue(minimumBalconies),
        balconyPreference,
        preferredFloor: preferredFloor.trim() || "any",
      });
      setSaved(true);
    } catch {
      // The shared mutation hook renders the API error toast.
    }
  };

  if (!isHydrated || isSessionPending) {
    return (
      <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
        Loading your alerts...
      </div>
    );
  }

  if (!isConsumer) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        A consumer account is required to create and manage To-Let alerts.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {saved ? (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
          <div>
            <p className="font-semibold">Alert preferences saved</p>
            <p className="mt-1 text-emerald-800">
              Your saved search is now listed below.
            </p>
          </div>
        </div>
      ) : null}

      <form className="space-y-5" onSubmit={saveAlert}>
        <p className="text-sm leading-6 text-muted-foreground">
          Alerts match your category, location and minimum size only. Other preferences are saved but do not limit notifications. Any rental type or Any location includes all options.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="alert-category">Preferred category *</Label>
            <select
              id="alert-category"
              value={preferredCategory}
              onChange={(event) =>
                setPreferredCategory(event.target.value as ToLetAlertCategory)
              }
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {toLetAlertCategoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="alert-location">Preferred location *</Label>
            <Input
              id="alert-location"
              value={preferredLocation}
              onChange={(event) => setPreferredLocation(event.target.value)}
              maxLength={200}
              placeholder="Area, district or division"
              required
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <NumberPreference
            id="alert-min-size"
            label="Minimum size (sq ft) *"
            value={minimumSizeSqFt}
            onChange={setMinimumSizeSqFt}
          />
          <NumberPreference
            id="alert-min-balconies"
            label="Balconies"
            value={minimumBalconies}
            onChange={setMinimumBalconies}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <NumberPreference
            id="alert-min-bedrooms"
            label="Bedrooms *"
            value={minimumBedrooms}
            onChange={setMinimumBedrooms}
          />
          <NumberPreference
            id="alert-min-bathrooms"
            label="Bathrooms *"
            value={minimumBathrooms}
            onChange={setMinimumBathrooms}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="alert-balcony">Balcony preference</Label>
            <select
              id="alert-balcony"
              value={balconyPreference}
              onChange={(event) =>
                setBalconyPreference(
                  event.target.value as
                    | "required"
                    | "optional"
                    | "not_required",
                )
              }
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="required">Required</option>
              <option value="optional">Optional</option>
              <option value="not_required">Not required</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="alert-floor">Preferred floor</Label>
            <Input
              id="alert-floor"
              value={preferredFloor}
              onChange={(event) => setPreferredFloor(event.target.value)}
              maxLength={30}
              placeholder="Any, ground, 1st..."
            />
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
          {onClose ? (
            <Button type="button" variant="outline" onClick={onClose}>
              Close
            </Button>
          ) : null}
          <Button type="submit" disabled={createAlert.isPending}>
            {createAlert.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Bell className="size-4" />
            )}
            {createAlert.isPending ? "Saving alert..." : "Save alert"}
          </Button>
        </div>
      </form>

      <section
        className="border-t border-border pt-6"
        aria-labelledby="saved-alert-list-heading"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="saved-alert-list-heading" className="font-semibold">
              My saved alerts
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Pause, resume or delete a saved property search at any time.
            </p>
          </div>
          <Link
            href="/to-let#listings"
            className="text-sm font-semibold text-primary hover:underline"
          >
            Browse listings
          </Link>
        </div>

        {alertsQuery.isLoading ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Loading alerts...
          </p>
        ) : alertsQuery.isError ? (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Saved alerts could not be loaded. Refresh this page and try again.
          </p>
        ) : alerts.length > 0 ? (
          <div className="mt-4 divide-y divide-border rounded-xl border border-border">
            {alerts.map((alert) => (
              <article
                key={alert.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{alert.preferredLocation}</p>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold uppercase text-muted-foreground">
                      {alert.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {categoryLabel(alert.preferredCategory)} · Min{" "}
                    {alert.minimumSizeSqFt.toLocaleString("en-BD")} sq ft ·{" "}
                    {alert.minimumBedrooms}+ bed · {alert.minimumBathrooms}+
                    bath
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                {alert.status !== "fulfilled" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="self-start sm:self-auto"
                    aria-label={`${alert.status === "active" ? "Pause" : "Resume"} ${categoryLabel(alert.preferredCategory)} alert for ${alert.preferredLocation}`}
                    disabled={updateStatus.isPending || deleteAlert.isPending}
                    onClick={() =>
                      updateStatus.mutate({
                        alertId: alert.id,
                        status: alert.status === "active" ? "paused" : "active",
                      })
                    }
                  >
                    {alert.status === "active" ? (
                      <Pause className="size-3.5" />
                    ) : (
                      <Play className="size-3.5" />
                    )}
                    {alert.status === "active" ? "Pause" : "Resume"}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  aria-label={`Delete ${categoryLabel(alert.preferredCategory)} alert for ${alert.preferredLocation}`}
                  disabled={deleteAlert.isPending || updateStatus.isPending}
                  onClick={() => {
                    if (window.confirm(`Delete your saved alert for ${alert.preferredLocation}? New matches for this search will stop. Previously received notifications will remain.`)) {
                      deleteAlert.mutate({ alertId: alert.id }, { onSuccess: () => setSaved(false) });
                    }
                  }}
                >
                  {deleteAlert.isPending && deleteAlert.variables?.alertId === alert.id
                    ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                    : <Trash2 className="size-3.5" aria-hidden="true" />}
                  Delete
                </Button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">
            No saved alert yet. Add your preferences above to create one.
          </div>
        )}
      </section>
    </div>
  );
}

function NumberPreference({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
