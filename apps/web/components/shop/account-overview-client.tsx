"use client";

import { formatDistanceToNow } from "date-fns";
import {
  ArrowRight,
  Building2,
  FileQuestion,
  FileText,
  MapPin,
  Package,
  ReceiptText,
  User,
} from "lucide-react";
import Link from "next/link";
import type { AccountAudience } from "@/components/account/account-navigation";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useMyAddresses,
  useMyOrders,
  useProfile,
} from "@/hooks/use-customer-api";
import { useToLetPropertyNavigation } from "@/hooks/use-to-let-property-api";
import { getConsumerPhasePresentationForMode } from "@/lib/consumer-order-presentation";
import { formatPrice } from "@/utils/currency";

export function AccountOverviewClient({
  audience,
}: {
  audience: AccountAudience;
}) {
  const {
    data: ordersData,
    isLoading: ordersLoading,
    isError: ordersError,
  } = useMyOrders();
  const {
    data: profileData,
    isLoading: profileLoading,
    isError: profileError,
  } = useProfile();
  const {
    data: addressesData,
    isLoading: addressesLoading,
    isError: addressesError,
  } = useMyAddresses();
  const propertyNavigation = useToLetPropertyNavigation();
  type CustomerOrder = NonNullable<typeof ordersData>["orders"][number];

  if (ordersLoading || profileLoading || addressesLoading) {
    return <AccountOverviewSkeleton />;
  }

  if (ordersError || profileError || addressesError) {
    return (
      <div
        role="alert"
        className="rounded-lg border border-red-200 bg-white p-6 text-sm text-red-700"
      >
        We could not load your account overview. Refresh the page to try again.
      </div>
    );
  }

  const profile = profileData?.profile;
  const orders = ordersData?.orders ?? [];
  const addresses = addressesData?.addresses ?? [];
  const defaultAddress =
    addresses.find((address) => address.isDefault) ?? addresses[0];
  const userName =
    profile?.ownerName || profile?.name || profile?.businessName || "User";
  const recentOrders = orders.slice(0, 4);
  const activeOrders = orders.filter((order) =>
    [
      "placed",
      "confirmed",
      "preparing",
      "out_for_delivery",
      "delivery_issue",
    ].includes(order.journey.phase),
  ).length;

  const accountTools = [
    {
      label: "Open Orders",
      description: "Review requests and seller offers",
      href: "/account/open-orders",
      icon: ReceiptText,
    },
    ...(audience === "shop"
      ? [
          {
            label: "Estimates",
            description: "Review quotes and convert approved estimates",
            href: "/account/estimates",
            icon: FileText,
          },
          {
            label: "Requested Items",
            description: "Follow items you asked Bikalpo to source",
            href: "/account/requests",
            icon: FileQuestion,
          },
        ]
      : []),
    ...(propertyNavigation.isConsumer
      ? [
          {
            label: propertyNavigation.label,
            description: propertyNavigation.description,
            href: propertyNavigation.href,
            icon: Building2,
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-zinc-950 sm:text-3xl">
          Manage My Account
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-6 text-zinc-600">
          Keep your contact and delivery details current, then pick up where
          your buying activity left off.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)]">
        <section
          aria-labelledby="personal-profile-heading"
          className="rounded-lg border border-zinc-200 bg-white"
        >
          <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4">
            <div className="flex items-center gap-2.5">
              <User className="size-4 text-zinc-400" aria-hidden="true" />
              <h2
                id="personal-profile-heading"
                className="font-semibold text-zinc-950"
              >
                Personal Profile
              </h2>
            </div>
            <Link
              href="/account/profile"
              className="inline-flex min-h-11 items-center px-1 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              Edit
            </Link>
          </div>
          <dl className="divide-y divide-zinc-100 px-5">
            <ProfileField label="Name" value={userName} />
            <ProfileField label="Email" value={profile?.email || "Not added"} />
            <ProfileField
              label="Phone"
              value={profile?.phoneNumber || "Add a phone number"}
              muted={!profile?.phoneNumber}
            />
            <ProfileField
              label="WhatsApp"
              value={profile?.whatsapp || "Add a WhatsApp number"}
              muted={!profile?.whatsapp}
            />
          </dl>
        </section>

        <section
          aria-labelledby="address-book-heading"
          className="rounded-lg border border-zinc-200 bg-white"
        >
          <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4">
            <div className="flex items-center gap-2.5">
              <MapPin className="size-4 text-zinc-400" aria-hidden="true" />
              <div>
                <h2
                  id="address-book-heading"
                  className="font-semibold text-zinc-950"
                >
                  Address Book
                </h2>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {addresses.length} saved{" "}
                  {addresses.length === 1 ? "address" : "addresses"}
                </p>
              </div>
            </div>
            <Link
              href="/account/addresses"
              className="inline-flex min-h-11 items-center px-1 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              {defaultAddress ? "Manage" : "Add"}
            </Link>
          </div>

          {defaultAddress ? (
            <div className="px-5 py-5">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-zinc-950">
                  {defaultAddress.label}
                </p>
                {defaultAddress.isDefault && (
                  <Badge
                    variant="outline"
                    className="border-blue-200 bg-blue-50 text-blue-700"
                  >
                    Default delivery address
                  </Badge>
                )}
              </div>
              <address className="mt-4 max-w-xl space-y-1 not-italic text-sm leading-6 text-zinc-600">
                <p className="font-medium text-zinc-900">
                  {defaultAddress.recipientName}
                </p>
                <p>{defaultAddress.phone}</p>
                <p>{defaultAddress.address}</p>
                <p>
                  {[
                    defaultAddress.area,
                    defaultAddress.city,
                    defaultAddress.postalCode,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              </address>
            </div>
          ) : (
            <div className="flex min-h-52 flex-col justify-center px-5 py-8">
              <p className="font-medium text-zinc-950">
                No delivery address saved
              </p>
              <p className="mt-1 max-w-md text-sm leading-6 text-zinc-600">
                Add the address you use most so checkout takes less time.
              </p>
              <Link
                href="/account/addresses"
                className="mt-3 inline-flex min-h-11 w-fit items-center gap-2 text-sm font-medium text-primary hover:underline"
              >
                Add your first address
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          )}
        </section>
      </div>

      <section
        aria-labelledby="recent-orders-heading"
        className="overflow-hidden rounded-lg border border-zinc-200 bg-white"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-5 py-4">
          <div>
            <h2
              id="recent-orders-heading"
              className="font-semibold text-zinc-950"
            >
              Recent Orders
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              <span className="font-mono tabular-nums">{activeOrders}</span>{" "}
              active ·{" "}
              <span className="font-mono tabular-nums">{orders.length}</span>{" "}
              total
            </p>
          </div>
          <Link
            href="/account/orders"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-primary outline-none hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
          >
            View all orders
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <div className="flex min-h-44 flex-col items-center justify-center px-5 py-8 text-center">
            <Package className="size-7 text-zinc-300" aria-hidden="true" />
            <p className="mt-3 font-medium text-zinc-950">No orders yet</p>
            <p className="mt-1 text-sm text-zinc-500">
              Your order activity will appear here after checkout.
            </p>
            <Link
              href="/products"
              className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline"
            >
              Browse products
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {recentOrders.map((order: CustomerOrder) => (
              <RecentOrderRow key={order.id} order={order} />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="account-tools-heading">
        <h2
          id="account-tools-heading"
          className="text-base font-semibold text-zinc-950"
        >
          More to manage
        </h2>
        <div className="mt-3 overflow-hidden rounded-lg border border-zinc-200 bg-white sm:grid sm:grid-cols-2 sm:divide-x sm:divide-zinc-200">
          {accountTools.map((tool, index) => {
            const Icon = tool.icon;
            return (
              <Link
                key={tool.href}
                href={tool.href}
                className={`group flex min-h-20 items-center gap-3 px-4 py-3 outline-none transition-colors hover:bg-zinc-50 focus-visible:bg-blue-50 ${
                  index > 1
                    ? "border-t border-zinc-200"
                    : index > 0
                      ? "border-t border-zinc-200 sm:border-t-0"
                      : ""
                }`}
              >
                <Icon
                  className="size-4 shrink-0 text-zinc-400 group-hover:text-primary"
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-zinc-950">
                    {tool.label}
                  </span>
                  <span className="mt-0.5 block text-xs leading-5 text-zinc-500">
                    {tool.description}
                  </span>
                </span>
                <ArrowRight
                  className="size-4 shrink-0 text-zinc-300 group-hover:text-primary"
                  aria-hidden="true"
                />
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function ProfileField({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3 py-3.5 text-sm">
      <dt className="text-zinc-500">{label}</dt>
      <dd
        className={
          muted
            ? "break-all text-zinc-400"
            : "break-all font-medium text-zinc-900"
        }
      >
        {value}
      </dd>
    </div>
  );
}

function RecentOrderRow({
  order,
}: {
  order: NonNullable<ReturnType<typeof useMyOrders>["data"]>["orders"][number];
}) {
  const presentation = getConsumerPhasePresentationForMode(
    order.journey.phase,
    order.journey.fulfillmentMode,
  );

  return (
    <Link
      href={`/account/orders/${order.orderNumber}`}
      className="group grid gap-3 px-5 py-4 outline-none transition-colors hover:bg-zinc-50 focus-visible:bg-blue-50 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-mono text-sm font-semibold tabular-nums text-zinc-950">
            {order.orderNumber}
          </p>
          <Badge
            variant="outline"
            className={`${presentation.badgeClassName} text-xs`}
          >
            {presentation.label}
          </Badge>
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          {order.items.length} {order.items.length === 1 ? "item" : "items"} ·{" "}
          {formatDistanceToNow(new Date(order.createdAt), { addSuffix: true })}
        </p>
      </div>
      <p className="font-mono text-sm font-semibold tabular-nums text-zinc-950 sm:text-right">
        {formatPrice(Number(order.total))}
      </p>
      <ArrowRight
        className="hidden size-4 text-zinc-300 group-hover:text-primary sm:block"
        aria-hidden="true"
      />
    </Link>
  );
}

function AccountOverviewSkeleton() {
  return (
    <div
      className="space-y-6"
      role="status"
      aria-label="Loading account overview"
    >
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)]">
        <Skeleton className="h-64 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
      <Skeleton className="h-72 rounded-lg" />
    </div>
  );
}
