"use client";

import { Bell, CheckCircle2, Loader2, Pause, Play, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  alertsFromResponse,
  type ToLetAlertCategory,
  type ToLetRentalAlertView,
  toLetAlertCategoryOptions,
  useCreateToLetAlert,
  useDeleteToLetAlert,
  useMyToLetAlerts,
  useUpdateToLetAlertStatus,
} from "@/hooks/use-to-let-rental-api";
import { authClient } from "@/lib/auth-client";
import {
  alertLocationError,
  alertPreferenceInteger,
  emptyAlertLocation,
  preferredAlertLocation,
  updateAlertLocation,
} from "@/lib/to-let-alert-location";
import type { ToLetMarketRentalType } from "@/lib/to-let-marketplace";
import {
  AlertLocationFields,
  alertSelectClassName,
} from "./alert-location-fields";

interface ToLetAlertManagerProps {
  query?: string;
  selectedType?: ToLetMarketRentalType;
  onClose?: () => void;
  onSaved?: () => void;
  showSavedAlerts?: boolean;
  disabled?: boolean;
  focusOnOpen?: boolean;
  initialPreferences?: Partial<
    Pick<
      ToLetRentalAlertView,
      | "minimumSizeSqFt"
      | "minimumBedrooms"
      | "minimumBathrooms"
      | "minimumBalconies"
      | "preferredFloor"
    >
  >;
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
  onSaved,
  showSavedAlerts = true,
  disabled = false,
  focusOnOpen = false,
  initialPreferences,
}: ToLetAlertManagerProps) {
  const { data: session, isPending: isSessionPending } =
    authClient.useSession();
  const [isHydrated, setIsHydrated] = useState(false);
  const [saved, setSaved] = useState(false);
  const categoryField = useRef<HTMLSelectElement>(null);
  const [preferredCategory, setPreferredCategory] =
    useState<ToLetAlertCategory>(selectedType ?? "any");
  const [locationSelection, setLocationSelection] =
    useState(emptyAlertLocation);
  const [searchLocation, setSearchLocation] = useState(query.trim());
  const [minimumSizeSqFt, setMinimumSizeSqFt] = useState(
    String(initialPreferences?.minimumSizeSqFt ?? 0),
  );
  const [minimumBedrooms, setMinimumBedrooms] = useState(
    String(initialPreferences?.minimumBedrooms ?? 0),
  );
  const [minimumBathrooms, setMinimumBathrooms] = useState(
    String(initialPreferences?.minimumBathrooms ?? 0),
  );
  const [minimumBalconies, setMinimumBalconies] = useState(
    String(initialPreferences?.minimumBalconies ?? 0),
  );
  const [preferredFloor, setPreferredFloor] = useState(
    initialPreferences?.preferredFloor ?? "any",
  );

  const role = (session?.user as { role?: string | null } | undefined)?.role;
  const isConsumer = role === "consumer";
  const alertsQuery = useMyToLetAlerts(
    isHydrated && isConsumer && showSavedAlerts,
  );
  const createAlert = useCreateToLetAlert();
  const updateStatus = useUpdateToLetAlertStatus();
  const deleteAlert = useDeleteToLetAlert();
  const alerts = alertsFromResponse(alertsQuery.data);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (focusOnOpen && isHydrated && isConsumer && !disabled) {
      categoryField.current?.focus({ preventScroll: true });
    }
  }, [focusOnOpen, isHydrated, isConsumer, disabled]);

  useEffect(() => {
    setPreferredCategory(selectedType ?? "any");
    setSearchLocation(query.trim());
    setLocationSelection(emptyAlertLocation);
    setSaved(false);
  }, [query, selectedType]);

  const saveAlert = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (disabled || createAlert.isPending) return;
    const locationError = alertLocationError(locationSelection);
    if (locationError) {
      toast.error(locationError);
      return;
    }
    const location =
      searchLocation || preferredAlertLocation(locationSelection);
    if (location.length < 2 || location.length > 200) {
      toast.error(
        "Your search location must contain 2 to 200 characters. Clear it to choose an address.",
      );
      return;
    }
    const size = alertPreferenceInteger(minimumSizeSqFt, 1_000_000);
    const bedrooms = alertPreferenceInteger(minimumBedrooms, 100);
    const bathrooms = alertPreferenceInteger(minimumBathrooms, 100);
    const balconies = alertPreferenceInteger(minimumBalconies, 100);
    if (
      size === null ||
      bedrooms === null ||
      bathrooms === null ||
      balconies === null
    ) {
      toast.error(
        "Enter whole numbers: size up to 1,000,000 sq ft and room counts up to 100.",
      );
      return;
    }

    try {
      await createAlert.mutateAsync({
        preferredCategory,
        preferredLocation: location,
        minimumSizeSqFt: size,
        minimumBedrooms: bedrooms,
        minimumBathrooms: bathrooms,
        minimumBalconies: balconies,
        balconyPreference: "optional",
        preferredFloor: preferredFloor.trim() || "any",
      });
      setSaved(true);
      onSaved?.();
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
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"
        >
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
          <div>
            <p className="font-semibold">Alert preferences saved</p>
            <p className="mt-1 text-emerald-800">
              {showSavedAlerts
                ? "Your saved search is now listed below."
                : "Your saved search is available in My Alert."}
            </p>
          </div>
        </div>
      ) : null}

      <form className="space-y-5" onSubmit={saveAlert}>
        <p className="text-sm leading-6 text-muted-foreground">
          Alerts match your category, location and minimum size only. Other
          preferences are saved but do not limit notifications. Choose Any to
          include all options at that level.
        </p>
        {searchLocation && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted p-3 text-sm">
            <p className="min-w-0 break-words">
              Location from your search: <strong>{searchLocation}</strong>.
              Choose an address below to replace it.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSearchLocation("")}
            >
              Clear search location
            </Button>
          </div>
        )}
        <fieldset
          disabled={createAlert.isPending || disabled}
          className="min-w-0 space-y-5"
        >
          <legend className="sr-only">Create To-Let alert preferences</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="min-w-0 space-y-2">
              <Label htmlFor="alert-category">Category *</Label>
              <select
                id="alert-category"
                ref={categoryField}
                value={preferredCategory}
                onChange={(event) =>
                  setPreferredCategory(event.target.value as ToLetAlertCategory)
                }
                className={alertSelectClassName}
              >
                {toLetAlertCategoryOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-0 space-y-2">
              <Label htmlFor="alert-floor">Floor *</Label>
              <select
                id="alert-floor"
                value={preferredFloor}
                onChange={(event) => setPreferredFloor(event.target.value)}
                className={alertSelectClassName}
              >
                <option value="any">Any floor</option>
                <option value="basement">Basement</option>
                <option value="ground">Ground floor</option>
                {Array.from({ length: 100 }, (_, index) => index + 1).map(
                  (floor) => (
                    <option key={floor} value={String(floor)}>
                      Floor {floor}
                    </option>
                  ),
                )}
              </select>
            </div>
          </div>

          <AlertLocationFields
            value={locationSelection}
            onChange={(field, value) => {
              setLocationSelection((current) =>
                updateAlertLocation(current, field, value),
              );
              setSearchLocation("");
              setSaved(false);
            }}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <NumberPreference
              id="alert-min-size"
              label="Minimum Size (sq ft) *"
              value={minimumSizeSqFt}
              onChange={setMinimumSizeSqFt}
            />
            <NumberPreference
              id="alert-min-balconies"
              label="Balcony"
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
        </fieldset>
        <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
          {onClose ? (
            <Button type="button" variant="outline" onClick={onClose}>
              Close
            </Button>
          ) : null}
          <Button type="submit" disabled={createAlert.isPending || disabled}>
            {createAlert.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Bell className="size-4" />
            )}
            {createAlert.isPending ? "Creating alert..." : "Create Alert"}
          </Button>
        </div>
      </form>

      {showSavedAlerts && (
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
                        disabled={
                          updateStatus.isPending || deleteAlert.isPending
                        }
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
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      aria-label={`Delete ${categoryLabel(alert.preferredCategory)} alert for ${alert.preferredLocation}`}
                      disabled={deleteAlert.isPending || updateStatus.isPending}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Delete your saved alert for ${alert.preferredLocation}? New matches for this search will stop. Previously received notifications will remain.`,
                          )
                        ) {
                          deleteAlert.mutate(
                            { alertId: alert.id },
                            { onSuccess: () => setSaved(false) },
                          );
                        }
                      }}
                    >
                      {deleteAlert.isPending &&
                      deleteAlert.variables?.alertId === alert.id ? (
                        <Loader2
                          className="size-3.5 animate-spin"
                          aria-hidden="true"
                        />
                      ) : (
                        <Trash2 className="size-3.5" aria-hidden="true" />
                      )}
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
      )}
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
    <div className="min-w-0 space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {id === "alert-min-size" ? (
        <Input
          id={id}
          className="h-10"
          type="number"
          inputMode="numeric"
          min={0}
          max={1_000_000}
          step={1}
          value={value}
          required
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={alertSelectClassName}
        >
          <option value="0">Any</option>
          {Array.from({ length: 100 }, (_, index) => index + 1).map((count) => (
            <option key={count} value={String(count)}>
              {count}+
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
