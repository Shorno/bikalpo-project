"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Ban,
  LockKeyhole,
  UnlockKeyhole,
  UserRound,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ADMIN_BASE } from "@/lib/routes";
import { orpc } from "@/utils/orpc";

const backHref = `${ADMIN_BASE}/user-overview/consumers`;
const dateFormat = new Intl.DateTimeFormat("en-US", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const dateTimeFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});
const currency = new Intl.NumberFormat("en-BD", {
  style: "currency",
  currency: "BDT",
  maximumFractionDigits: 0,
});

function date(value: Date | string | null | undefined) {
  return value ? dateFormat.format(new Date(value)) : "—";
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b py-3 last:border-0 sm:grid-cols-[11rem_1fr] sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm font-medium">{value || "—"}</dd>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="gap-0 border py-0 shadow-none ring-0">
      <CardHeader className="border-b bg-muted/20 px-4 py-4 sm:px-6">
        <CardTitle className="text-sm font-semibold sm:text-base">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 py-4 sm:px-6">{children}</CardContent>
    </Card>
  );
}

export function ConsumerDetailClient({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const [accessAction, setAccessAction] = useState<
    "suspend" | "block" | "activate" | null
  >(null);
  const query = useQuery(
    orpc.adminConsumerManagement.getById.queryOptions({ input: { userId } }),
  );
  const access = useMutation({
    mutationFn: (action: "suspend" | "block" | "activate") =>
      orpc.adminConsumerManagement.setAccess.call({ userId, action }),
    onSuccess: (_, action) => {
      toast.success(
        action === "activate"
          ? "Consumer account reactivated"
          : action === "suspend"
            ? "Consumer account suspended"
            : "Consumer account blocked",
      );
      setAccessAction(null);
      void queryClient.invalidateQueries();
    },
    onError: (error) =>
      toast.error(error.message || "Could not update account access"),
  });

  if (query.isLoading) {
    return (
      <div
        role="status"
        aria-label="Loading consumer details"
        className="space-y-5"
      >
        <Skeleton className="h-9 w-44" />
        <Skeleton className="h-56 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }
  if (query.isError || !query.data) {
    return (
      <div role="alert" className="space-y-4 rounded-xl border p-8 text-center">
        <h1 className="text-lg font-semibold">
          Could not load consumer details
        </h1>
        <p className="text-sm text-muted-foreground">
          {query.error?.message || "Consumer not found."}
        </p>
        <Button asChild variant="outline">
          <Link href={backHref}>Back to Consumers</Link>
        </Button>
      </div>
    );
  }

  const {
    consumer,
    overview,
    addresses,
    orders,
    bookings,
    reviews,
    complaints,
    notes,
  } = query.data;
  const activeOrders = orders.filter((order) => order.status !== "cancelled");
  const cancelledOrders = orders.filter(
    (order) => order.status === "cancelled",
  );
  const properties = consumer.properties
    .map((property) => property.name)
    .join(", ");
  const statusColor =
    consumer.status === "Active"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : "bg-red-50 text-red-700 border-red-200";

  return (
    <div className="min-w-0 space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 gap-2">
        <Link href={backHref}>
          <ArrowLeft className="size-4" aria-hidden /> Back to Consumers
        </Link>
      </Button>

      <Section title="Consumer Details">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted text-muted-foreground">
            {consumer.image ? (
              <Image
                src={consumer.image}
                alt={`${consumer.name}'s profile`}
                width={80}
                height={80}
                unoptimized
                className="size-full object-cover"
              />
            ) : (
              <UserRound className="size-9" aria-hidden />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold tracking-tight">
              {consumer.name}
            </h1>
            <Badge variant="outline" className={`mt-2 ${statusColor}`}>
              {consumer.status}
            </Badge>
            <dl className="mt-4 grid gap-x-8 sm:grid-cols-2">
              <Info
                label="User ID"
                value={<span className="font-mono">{consumer.idNumber}</span>}
              />
              <Info label="Full Name" value={consumer.name} />
              <Info label="Account Type" value={consumer.accountType} />
              <Info
                label="Mobile Number"
                value={consumer.phoneNumber ?? "Not added"}
              />
              <Info label="Profile Status" value="Not tracked" />
              <Info label="Member Since" value={date(consumer.createdAt)} />
              <Info
                label="Property"
                value={consumer.properties.length > 0 ? "Yes" : "No"}
              />
            </dl>
            <div className="mt-5 flex flex-wrap gap-2">
              {consumer.status === "Active" ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setAccessAction("suspend")}
                  >
                    <Ban className="size-4" aria-hidden /> Suspend Account
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => setAccessAction("block")}
                  >
                    <LockKeyhole className="size-4" aria-hidden /> Block Account
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => setAccessAction("activate")}
                >
                  <UnlockKeyhole className="size-4" aria-hidden /> Reactivate
                  Account
                </Button>
              )}
            </div>
          </div>
        </div>
      </Section>

      <section aria-labelledby="consumer-overview" className="space-y-3">
        <h2 id="consumer-overview" className="text-sm font-semibold">
          Quick Overview
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[
            ["Total Orders", overview.totalOrders],
            ["Completed Orders", overview.completedOrders],
            ["Cancelled Orders", overview.cancelledOrders],
            ["Total Followed", overview.followedStores],
            ["Saved Items", "Not tracked"],
            ["Reviews", overview.reviewCount],
          ].map(([label, value]) => (
            <Card
              key={label}
              className="gap-2 border px-5 py-4 shadow-none ring-0"
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {label}
              </span>
              <span className="font-mono text-2xl font-semibold">{value}</span>
            </Card>
          ))}
        </div>
      </section>

      <Section title="Personal Information">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Contact Information
        </h3>
        <dl>
          <Info label="Full Name" value={consumer.name} />
          <Info
            label="Consumer ID"
            value={<span className="font-mono">{consumer.idNumber}</span>}
          />
          <Info
            label="Mobile Number"
            value={consumer.phoneNumber ?? "Not added"}
          />
          <Info label="Email Address" value={consumer.email} />
          <Info
            label="WhatsApp Number"
            value={consumer.whatsapp ?? "Not added"}
          />
          <Info label="Date of Birth" value="Not added" />
          <Info label="Gender" value="Not added" />
          <Info label="Profile Status" value="Not tracked" />
          <Info label="Account Type" value={consumer.accountType} />
          <Info label="Property Registered" value={properties || "None"} />
          <Info label="Account Status" value={consumer.status} />
        </dl>
        <h3 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Social Information
        </h3>
        <dl>
          <Info label="Facebook" value={consumer.facebook ?? "Not connected"} />
          <Info label="Instagram" value="Not recorded" />
          <Info label="TikTok" value="Not recorded" />
          <Info
            label="WhatsApp"
            value={consumer.whatsapp ? "Connected" : "Not connected"}
          />
        </dl>
      </Section>

      <Section title="Address & Location">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Saved Addresses
        </h3>
        {addresses.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {addresses.map((address) => (
              <div key={address.id} className="rounded-lg border p-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  {address.label}
                  {address.isDefault && (
                    <Badge variant="secondary">Default</Badge>
                  )}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {[address.address, address.area, address.city]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No saved addresses.</p>
        )}
      </Section>

      <Section title="My Orders">
        <Tabs defaultValue="orders">
          <TabsList>
            <TabsTrigger value="orders">
              My Orders ({overview.totalOrders - overview.cancelledOrders})
            </TabsTrigger>
            <TabsTrigger value="cancelled">
              Cancelled Orders ({overview.cancelledOrders})
            </TabsTrigger>
          </TabsList>
          {(
            [
              ["orders", activeOrders],
              ["cancelled", cancelledOrders],
            ] as const
          ).map(([tab, items]) => (
            <TabsContent key={tab} value={tab} className="mt-4">
              {items.length ? (
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order ID</TableHead>
                        <TableHead>Order Date</TableHead>
                        <TableHead>Seller / Store</TableHead>
                        <TableHead>Items</TableHead>
                        <TableHead>Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono text-xs">
                            {item.orderNumber}
                          </TableCell>
                          <TableCell>{date(item.createdAt)}</TableCell>
                          <TableCell>
                            {item.shopName || "Finding seller"}
                          </TableCell>
                          <TableCell className="font-mono">
                            {item.itemCount}
                          </TableCell>
                          <TableCell className="font-mono">
                            {currency.format(Number(item.total))}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No {tab === "cancelled" ? "cancelled " : ""}orders found.
                </p>
              )}
            </TabsContent>
          ))}
        </Tabs>
        {overview.totalOrders > orders.length && (
          <p className="mt-3 text-xs text-muted-foreground">
            Showing the latest {orders.length} orders.
          </p>
        )}
      </Section>

      <Section title="My Bookings">
        {bookings.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {bookings.map((booking) => (
              <div key={booking.id} className="rounded-lg border p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs">
                    BKG-{booking.publicNumber}
                  </span>
                  <Badge variant="outline">{booking.status}</Badge>
                </div>
                <p className="mt-2 text-sm font-semibold">{booking.title}</p>
                <p className="text-sm text-muted-foreground">
                  {booking.location}
                </p>
                <p className="mt-3 text-xs text-muted-foreground">
                  Booked on {dateTimeFormat.format(new Date(booking.createdAt))}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No bookings found.</p>
        )}
      </Section>

      <Section title="Reviews">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Review List
        </h3>
        {reviews.length ? (
          <div className="divide-y">
            {reviews.map((review) => (
              <dl key={review.id} className="py-4 first:pt-0 last:pb-0">
                <Info label="Review ID" value={`REV-${review.id}`} />
                <Info label="Order ID" value="Not linked" />
                <Info label="Product" value={review.productName} />
                <Info
                  label="Rating"
                  value={`${"★".repeat(Math.max(0, Math.min(5, review.rating)))}${"☆".repeat(Math.max(0, 5 - review.rating))}`}
                />
                <Info label="Review Date" value={date(review.createdAt)} />
                <Info label="Review Status" value="Published" />
                <Info label="Review Text" value={review.text} />
              </dl>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No reviews found.</p>
        )}
      </Section>

      <Section title="Complaints & Reports">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Complaint List
        </h3>
        {complaints.length ? (
          <div className="divide-y">
            {complaints.map((item) => (
              <dl key={item.id} className="py-4 first:pt-0 last:pb-0">
                <Info label="Complaint ID" value={item.complaintNumber} />
                <Info label="Complaint Date" value={date(item.createdAt)} />
                <Info label="Complaint Type" value={item.type} />
                <Info label="Related Order" value={item.orderNumber} />
                <Info label="Related Seller" value={item.sellerName || "—"} />
                <Info label="Complaint Description" value={item.description} />
                <Info label="Complaint Status" value={item.status} />
                <Info
                  label="Assigned Admin"
                  value={item.assignedAdmin || "Unassigned"}
                />
                <Info label="Resolved Date" value={date(item.resolvedAt)} />
                <Info label="Resolution" value={item.resolution || "—"} />
              </dl>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No complaints found.</p>
        )}
      </Section>

      <Section title="Admin Notes">
        {notes.length ? (
          <div className="divide-y">
            {notes.map((note) => (
              <dl key={note.id} className="py-4 first:pt-0 last:pb-0">
                <Info
                  label="Note Title"
                  value={`Support ticket ${note.ticketNumber}`}
                />
                <Info label="Note Type" value="Support Note" />
                <Info label="Description" value={note.note} />
                <Info label="Created By" value={note.createdBy || "—"} />
                <Info label="Created Date" value={date(note.createdAt)} />
              </dl>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No admin notes linked to this consumer’s support tickets.
          </p>
        )}
      </Section>

      <Dialog
        open={accessAction !== null}
        onOpenChange={(open) => {
          if (!open && !access.isPending) setAccessAction(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {accessAction === "activate"
                ? "Reactivate"
                : accessAction === "suspend"
                  ? "Suspend"
                  : "Block"}{" "}
              Consumer
            </DialogTitle>
            <DialogDescription>
              {accessAction === "suspend"
                ? "This account will be unable to sign in for 30 days."
                : accessAction === "block"
                  ? "This account will be unable to sign in until an admin reactivates it."
                  : "This account will regain access to the platform."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={access.isPending}
              onClick={() => setAccessAction(null)}
            >
              Cancel
            </Button>
            <Button
              variant={accessAction === "block" ? "destructive" : "default"}
              disabled={access.isPending || !accessAction}
              onClick={() => accessAction && access.mutate(accessAction)}
            >
              {access.isPending ? "Saving..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
