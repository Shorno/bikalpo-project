"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2, Search, Trash2 } from "lucide-react";
import { useDeferredValue, useState } from "react";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { orpc } from "@/utils/orpc";

type AdminUnit = {
  unitCode: string;
  name: string;
  unitType: string;
  status: "vacant" | "booked" | "occupied" | "inactive";
  property: {
    propertyCode: string;
    name: string;
    ownerName: string;
    mobileNumber: string;
  };
  latestListing: { listingCode: string; status: string } | null;
  listingCount: number;
  pendingBookings: number;
  acceptedBookings: number;
  totalBookings: number;
  contractCount: number;
  hasOngoingContract: boolean;
};

const statusStyles: Record<AdminUnit["status"], string> = {
  vacant: "border-border bg-muted text-foreground",
  booked: "border-amber-200 bg-amber-50 text-amber-800",
  occupied: "border-red-200 bg-red-50 text-red-800",
  inactive: "border-border bg-muted text-muted-foreground",
};

function humanize(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function DeleteUnitButton({ unit }: { unit: AdminUnit }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const remove = useMutation({
    ...orpc.adminToLetUnit.delete.mutationOptions(),
    onSuccess: async (result) => {
      toast.success(`${result.unitCode} permanently deleted`);
      setOpen(false);
      await queryClient.invalidateQueries({
        queryKey: orpc.adminToLetUnit.list.key(),
      });
    },
    onError: (error) => toast.error(error.message),
  });
  const isBooked =
    unit.status === "booked" ||
    unit.status === "occupied" ||
    unit.hasOngoingContract ||
    unit.acceptedBookings > 0;
  const confirmed = confirmation.trim().toUpperCase() === unit.unitCode;

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setConfirmation("");
      }}
    >
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="text-red-600 hover:bg-red-50 hover:text-red-700"
          aria-label={`Delete ${unit.unitCode}`}
        >
          <Trash2 /> Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Permanently delete {unit.unitCode}?</AlertDialogTitle>
          <AlertDialogDescription>
            {unit.name} in {unit.property.name} will be removed from the
            database together with everything linked to it. This cannot be
            undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {isBooked ? (
          <div
            role="alert"
            className="flex gap-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p>
              This unit is{" "}
              <strong>
                {unit.status === "occupied" || unit.hasOngoingContract
                  ? "occupied by a tenant"
                  : "booked"}
              </strong>
              . Deleting it removes the tenant&apos;s booking, rental contract
              and rent payment history. The tenant will lose access to this
              rental.
            </p>
          </div>
        ) : null}

        <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 rounded-md border border-border p-3 text-sm">
          <dt className="text-muted-foreground">Listings</dt>
          <dd className="font-mono tabular-nums">{unit.listingCount}</dd>
          <dt className="text-muted-foreground">Booking requests</dt>
          <dd className="font-mono tabular-nums">{unit.totalBookings}</dd>
          <dt className="text-muted-foreground">
            Rental contracts (with payments)
          </dt>
          <dd className="font-mono tabular-nums">{unit.contractCount}</dd>
        </dl>

        <label className="block space-y-1.5 text-sm">
          <span>
            Type <span className="font-mono font-semibold">{unit.unitCode}</span>{" "}
            to confirm
          </span>
          <Input
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder={unit.unitCode}
            autoComplete="off"
            className="font-mono"
          />
        </label>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={!confirmed || remove.isPending}
            onClick={(event) => {
              event.preventDefault();
              remove.mutate({ unitCode: unit.unitCode });
            }}
          >
            {remove.isPending ? <Loader2 className="animate-spin" /> : <Trash2 />}
            Delete permanently
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function AdminToLetUnitsClient() {
  const [search, setSearch] = useState("");
  const q = useDeferredValue(search.trim());
  const query = useQuery(
    orpc.adminToLetUnit.list.queryOptions({ input: { q, limit: 200 } }),
  );
  const units = (query.data?.units ?? []) as AdminUnit[];

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">To-Let Units</h1>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          Every unit registered by property owners. Deleting a unit permanently
          removes its listings, booking requests, rental contracts and rent
          payments.
        </p>
      </div>

      <label className="relative block max-w-md">
        <span className="sr-only">Search units</span>
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Unit ID, property ID, name, owner or phone"
          className="pl-9"
        />
      </label>

      {query.isLoading ? (
        <div className="space-y-2" role="status" aria-label="Loading units">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-14 w-full" />
          ))}
        </div>
      ) : query.isError ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p>Units could not be loaded.</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 bg-card"
            onClick={() => query.refetch()}
          >
            Try again
          </Button>
        </div>
      ) : units.length === 0 ? (
        <div className="rounded-md border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
          {q ? `No units match “${q}”.` : "No To-Let units have been registered yet."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unit</TableHead>
                <TableHead>Property</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Listing</TableHead>
                <TableHead className="text-right">Bookings</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {units.map((unit) => (
                <TableRow key={unit.unitCode}>
                  <TableCell>
                    <p className="font-medium">{unit.name}</p>
                    <p className="font-mono text-xs text-muted-foreground tabular-nums">
                      {unit.unitCode} · {humanize(unit.unitType)}
                    </p>
                  </TableCell>
                  <TableCell>
                    <p>{unit.property.name}</p>
                    <p className="font-mono text-xs text-muted-foreground tabular-nums">
                      {unit.property.propertyCode}
                    </p>
                  </TableCell>
                  <TableCell>
                    <p>{unit.property.ownerName}</p>
                    <p className="font-mono text-xs text-muted-foreground tabular-nums">
                      {unit.property.mobileNumber}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusStyles[unit.status]}>
                      {humanize(unit.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {unit.latestListing ? (
                      <>
                        <p className="font-mono text-sm tabular-nums">
                          {unit.latestListing.listingCode}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {humanize(unit.latestListing.status)}
                        </p>
                      </>
                    ) : (
                      <span className="text-sm text-muted-foreground">None</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {unit.pendingBookings > 0 ? (
                      <span className="text-amber-700">
                        {unit.pendingBookings} pending ·{" "}
                      </span>
                    ) : null}
                    {unit.totalBookings}
                  </TableCell>
                  <TableCell className="text-right">
                    <DeleteUnitButton unit={unit} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {units.length === 200 ? (
        <p className="text-xs text-muted-foreground">
          Showing the newest 200 units. Search to find older ones.
        </p>
      ) : null}
    </div>
  );
}
