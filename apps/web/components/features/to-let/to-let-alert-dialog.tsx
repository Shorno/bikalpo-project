"use client";

import { Bell, CheckCircle2, Loader2, Pause, Play } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  alertsFromResponse,
  useCreateToLetAlert,
  useMyToLetAlerts,
  useUpdateToLetAlertStatus,
} from "@/hooks/use-to-let-rental-api";
import { authClient } from "@/lib/auth-client";
import type { ToLetMarketRentalType } from "@/lib/to-let-marketplace";

const categoryOptions = [
  { value: "any", label: "Any rental type" },
  { value: "family_flat", label: "Family To-Let" },
  { value: "bachelor_room", label: "Bachelor Room" },
  { value: "sublet", label: "Sublet" },
  { value: "shop", label: "Shop" },
  { value: "office", label: "Office" },
  { value: "warehouse", label: "Warehouse" },
  { value: "garage", label: "Garage" },
  { value: "other", label: "Other" },
] as const;

type AlertCategory = (typeof categoryOptions)[number]["value"];

function integerValue(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function categoryLabel(value: string) {
  return (
    categoryOptions.find((option) => option.value === value)?.label ?? value
  );
}

export function ToLetAlertDialog({
  query,
  selectedType,
}: {
  query: string;
  selectedType?: ToLetMarketRentalType;
}) {
  const { data: session, isPending: isSessionPending } =
    authClient.useSession();
  const [isHydrated, setIsHydrated] = useState(false);
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [preferredCategory, setPreferredCategory] = useState<AlertCategory>(
    selectedType ?? "any",
  );
  const [preferredLocation, setPreferredLocation] = useState(
    query || "Any location",
  );
  const [minimumSizeSqFt, setMinimumSizeSqFt] = useState("0");
  const [minimumBedrooms, setMinimumBedrooms] = useState("0");
  const [minimumBathrooms, setMinimumBathrooms] = useState("0");
  const [minimumBalconies, setMinimumBalconies] = useState("0");
  const [balconyPreference, setBalconyPreference] = useState("optional");
  const [preferredFloor, setPreferredFloor] = useState("any");
  const isCheckingSession = !isHydrated || isSessionPending;
  const role = (session?.user as { role?: string | null } | undefined)?.role;
  const isConsumer = role === "consumer";
  const alertsQuery = useMyToLetAlerts(isHydrated && open && isConsumer);
  const createAlert = useCreateToLetAlert();
  const updateStatus = useUpdateToLetAlertStatus();
  const alerts = alertsFromResponse(alertsQuery.data);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (open) return;
    setPreferredCategory(selectedType ?? "any");
    setPreferredLocation(query || "Any location");
    setSaved(false);
  }, [open, query, selectedType]);

  const openAlertManager = () => {
    if (isCheckingSession) return;

    if (!session?.user) {
      const redirect = encodeURIComponent(
        `${window.location.pathname}${window.location.search}${window.location.hash}`,
      );
      window.location.assign(`/login?redirect=${redirect}`);
      return;
    }

    if (!isConsumer) {
      toast.error("A consumer account is required to save a To-Let alert");
      return;
    }

    setOpen(true);
  };

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
        balconyPreference: balconyPreference as
          | "required"
          | "optional"
          | "not_required",
        preferredFloor: preferredFloor.trim() || "any",
      });
      setSaved(true);
    } catch {
      // The shared mutation hook renders the API error toast.
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={openAlertManager}
        disabled={isCheckingSession}
        className="min-h-11 w-fit border-primary/25 bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary"
      >
        <Bell className="size-4" />
        {isCheckingSession ? "Checking..." : "My Alerts"}
      </Button>

      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Saved To-Let alerts</DialogTitle>
          <DialogDescription>
            Save your preferred location and unit requirements. You can return
            here to pause or resume each saved search.
          </DialogDescription>
        </DialogHeader>

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

        <form className="space-y-4" onSubmit={saveAlert}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="alert-location">Preferred location</Label>
              <Input
                id="alert-location"
                value={preferredLocation}
                onChange={(event) => setPreferredLocation(event.target.value)}
                maxLength={200}
                placeholder="Area, district or division"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="alert-category">Rental type</Label>
              <select
                id="alert-category"
                value={preferredCategory}
                onChange={(event) =>
                  setPreferredCategory(event.target.value as AlertCategory)
                }
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {categoryOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <NumberPreference
              id="alert-min-size"
              label="Min size (sq ft)"
              value={minimumSizeSqFt}
              onChange={setMinimumSizeSqFt}
            />
            <NumberPreference
              id="alert-min-bedrooms"
              label="Min bedrooms"
              value={minimumBedrooms}
              onChange={setMinimumBedrooms}
            />
            <NumberPreference
              id="alert-min-bathrooms"
              label="Min bathrooms"
              value={minimumBathrooms}
              onChange={setMinimumBathrooms}
            />
            <NumberPreference
              id="alert-min-balconies"
              label="Min balconies"
              value={minimumBalconies}
              onChange={setMinimumBalconies}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="alert-balcony">Balcony preference</Label>
              <select
                id="alert-balcony"
                value={balconyPreference}
                onChange={(event) => setBalconyPreference(event.target.value)}
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
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Close
            </Button>
            <Button type="submit" disabled={createAlert.isPending}>
              {createAlert.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Bell className="size-4" />
              )}
              Save alert
            </Button>
          </div>
        </form>

        <section
          className="border-t border-border pt-5"
          aria-labelledby="saved-alert-list-heading"
        >
          <div className="flex items-center justify-between gap-3">
            <h3 id="saved-alert-list-heading" className="font-semibold">
              My saved searches
            </h3>
            <Link
              href="/to-let#listings"
              onClick={() => setOpen(false)}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Browse listings
            </Link>
          </div>

          {alertsQuery.isLoading ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Loading alerts...
            </p>
          ) : alertsQuery.isError ? (
            <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              Saved alerts could not be loaded. Close this dialog and try again.
            </p>
          ) : alerts.length > 0 ? (
            <div className="mt-3 space-y-2">
              {alerts.map((alert) => (
                <article
                  key={alert.id}
                  className="flex flex-col gap-3 rounded-xl border border-border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-semibold">{alert.preferredLocation}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {categoryLabel(alert.preferredCategory)} · Min{" "}
                      {alert.minimumSizeSqFt.toLocaleString("en-BD")} sq ft ·{" "}
                      {alert.minimumBedrooms}+ bed
                    </p>
                    <p className="mt-1 text-[11px] font-semibold uppercase text-muted-foreground">
                      {alert.status}
                    </p>
                  </div>
                  {alert.status !== "fulfilled" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      aria-label={`${alert.status === "active" ? "Pause" : "Resume"} ${categoryLabel(alert.preferredCategory)} alert for ${alert.preferredLocation}`}
                      disabled={updateStatus.isPending}
                      onClick={() =>
                        updateStatus.mutate({
                          alertId: alert.id,
                          status:
                            alert.status === "active" ? "paused" : "active",
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
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-3 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              No saved alert yet. Use the form above to create one.
            </p>
          )}
        </section>
      </DialogContent>
    </Dialog>
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
