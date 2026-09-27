"use client";

import { priceProductDisplayId } from "@bikalpo-project/api/consumer-price";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ImageIcon, Loader2, Minus, Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RichTextContent } from "@/components/ui/rich-text-content";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ADMIN_BASE } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { orpc } from "@/utils/orpc";
import styles from "./product-price.module.css";
import { formatBdt } from "./product-price-table";

const ROUTE = `${ADMIN_BASE}/product-price`;
const dateLabel = (value: string | Date) =>
  new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeZone: "Asia/Dhaka",
  }).format(new Date(value));
const amount = (value: string | number) =>
  Number(value).toLocaleString("en-BD", { maximumFractionDigits: 2 });

export function ProductPriceDetailClient({ productId }: { productId: number }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const productQuery = useQuery(
    orpc.product.getAdminWebViewProductById.queryOptions({
      input: { id: productId },
    }),
  );
  const detailQuery = useQuery(
    orpc.product.getReferencePriceInventory.queryOptions({
      input: { productId },
    }),
  );
  const reviewsQuery = useQuery(
    orpc.customer.getProductReviews.queryOptions({ input: { productId } }),
  );
  const [owner, setOwner] = useState("all");
  const [saleMode, setSaleMode] = useState<"exchange" | "new">("exchange");
  const [quantity, setQuantity] = useState(1);
  const [imageFailed, setImageFailed] = useState(false);
  const candidate = searchParams.get("returnTo") ?? ROUTE;
  const returnTo =
    candidate === ROUTE || candidate.startsWith(`${ROUTE}?`)
      ? candidate
      : ROUTE;
  if (productQuery.isPending || detailQuery.isPending)
    return (
      <div
        role="status"
        className="flex items-center justify-center gap-2 p-12"
      >
        <Loader2 aria-hidden="true" className="size-5 animate-spin" />
        Loading inventory and prices…
      </div>
    );
  if (
    productQuery.isError ||
    detailQuery.isError ||
    !productQuery.data ||
    !detailQuery.data
  )
    return (
      <div role="alert" className="space-y-4 p-6">
        <p>
          {productQuery.error?.message ||
            detailQuery.error?.message ||
            "Product details are unavailable."}
        </p>
        <Button
          type="button"
          onClick={() => {
            void productQuery.refetch();
            void detailQuery.refetch();
          }}
        >
          Try again
        </Button>
        <Button asChild variant="outline">
          <Link href={returnTo}>Back to prices</Link>
        </Button>
      </div>
    );
  const product = productQuery.data.product;
  const detail = detailQuery.data;
  const selected =
    detail.prices.find(
      (row) => row.variantPriceId === Number(searchParams.get("variant")),
    ) ?? detail.prices[0];
  const selectedId = selected?.variantPriceId;
  const cylinder = selected?.isCylinderPricing ?? false;
  const exchange =
    cylinder && saleMode === "exchange" && selected?.exchangePrice != null;
  const unitPrice = selected
    ? Number(exchange ? selected.exchangePrice : selected.consumerPrice)
    : 0;
  const minQuantity = product.minimumOrderEnabled
    ? Number(product.minimumOrderQty)
    : 1;
  const effectiveQuantity = Math.max(minQuantity, quantity);
  const scopeKey = (row: { ownerType: string; ownerId: string }) =>
    `${row.ownerType}:${row.ownerId}`;
  const owners = new Map(
    [...detail.stock, ...detail.receipts]
      .filter((row) => row.priceIds.includes(selectedId ?? -1))
      .map((row) => [
        scopeKey(row),
        `${row.ownerName} (${row.ownerType === "shop" ? "Shop" : "Warehouse"})`,
      ]),
  );
  const effectiveOwner = owners.has(owner) ? owner : "all";
  const stock = detail.stock.filter(
    (row) =>
      row.priceIds.includes(selectedId ?? -1) &&
      (effectiveOwner === "all" || scopeKey(row) === effectiveOwner),
  );
  const receipts = detail.receipts.filter(
    (row) =>
      row.priceIds.includes(selectedId ?? -1) &&
      (effectiveOwner === "all" || scopeKey(row) === effectiveOwner),
  );
  const changeVariant = (id: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("variant", String(id));
    router.replace(`${ROUTE}/${productId}?${params}`, { scroll: false });
  };
  const rules = [
    [
      "Batch Tracking",
      product.trackingType === "batch" ? "Enabled" : "Disabled",
    ],
    ["Return Policy", product.returnPolicyEnabled ? "Allowed" : "Not allowed"],
    ["Expiry Tracking", product.expiryEnabled ? "Enabled" : "Disabled"],
    ["Damage Tracking", product.damageControlEnabled ? "Enabled" : "Disabled"],
    [
      "Minimum Order",
      `${amount(minQuantity)} ${selected?.operationalUnit ?? "unit"}`,
    ],
    [
      "Empty Pack Return",
      selected?.exchangeEnabled ? "Exchange available" : "Not enabled",
    ],
    ["Conversion", product.conversionEnabled ? "Enabled" : "Disabled"],
    [
      "Loose Inventory Unit",
      product.inventoryLooseUnitEnabled
        ? product.inventoryLooseUnit
        : "Not enabled",
    ],
  ];
  return (
    <div className={cn(styles.console, styles.panel)}>
      <div className={styles.panelHead}>
        <Button asChild variant="outline" size="sm">
          <Link href={returnTo}>
            <ArrowLeft aria-hidden="true" className="size-4" />
            Back
          </Link>
        </Button>
        <h1 className="min-w-0 flex-1 text-sm font-bold sm:text-base">
          {product.name}{" "}
          <span className="font-normal text-muted-foreground">
            {priceProductDisplayId(product.id)}
          </span>
        </h1>
        <Badge variant="secondary" className="capitalize">
          {product.status}
        </Badge>
      </div>
      <div className="grid gap-6 p-4 md:grid-cols-[minmax(240px,360px)_1fr] md:p-5">
        <div className="relative flex aspect-square max-h-[320px] items-center justify-center overflow-hidden rounded-lg border bg-muted/20">
          {product.image && !imageFailed ? (
            <Image
              src={product.image}
              alt={product.name}
              width={360}
              height={320}
              unoptimized
              className="h-full w-full object-contain"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <div className="text-center text-muted-foreground">
              <ImageIcon aria-hidden="true" className="mx-auto mb-2 size-10" />
              No product image
            </div>
          )}
        </div>
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-bold">{product.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Product ID: {priceProductDisplayId(product.id)} · Brand:{" "}
              {selected?.brandDisplay ?? product.brand?.name ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums">
              {selected ? formatBdt(unitPrice) : "Price unavailable"}
            </p>
            <p className="text-xs text-muted-foreground">
              {cylinder
                ? exchange
                  ? "Exchange reference price"
                  : "New cylinder reference price"
                : "Reference price"}{" "}
              · {selected?.variantValue}
            </p>
          </div>
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">
              {cylinder ? "Cylinder Size" : "Variant"}
            </legend>
            <div className="flex flex-wrap gap-2">
              {detail.prices.map((row) => (
                <label
                  key={row.variantPriceId}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm",
                    selectedId === row.variantPriceId &&
                      "border-primary bg-primary/5",
                  )}
                >
                  <input
                    type="radio"
                    name="price-detail-variant"
                    checked={selectedId === row.variantPriceId}
                    onChange={() => changeVariant(row.variantPriceId)}
                  />
                  {row.variantValue}
                </label>
              ))}
            </div>
          </fieldset>
          {cylinder && (
            <fieldset>
              <legend className="mb-2 text-sm font-semibold">
                Cylinder Type
              </legend>
              <div className="flex flex-wrap gap-2">
                {(["exchange", "new"] as const).map((mode) => (
                  <label
                    key={mode}
                    className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm capitalize"
                  >
                    <input
                      type="radio"
                      name="price-detail-mode"
                      checked={(exchange ? "exchange" : "new") === mode}
                      disabled={
                        mode === "exchange" && selected?.exchangePrice == null
                      }
                      onChange={() => setSaleMode(mode)}
                    />
                    {mode}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {selected && (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span>Quantity</span>
              <Button
                variant="outline"
                size="icon"
                aria-label="Decrease quantity"
                disabled={effectiveQuantity <= minQuantity}
                onClick={() =>
                  setQuantity(Math.max(minQuantity, effectiveQuantity - 1))
                }
              >
                <Minus aria-hidden="true" className="size-4" />
              </Button>
              <output aria-label="Quantity" className="tabular-nums">
                {amount(effectiveQuantity)}
              </output>
              <Button
                variant="outline"
                size="icon"
                aria-label="Increase quantity"
                onClick={() => setQuantity(effectiveQuantity + 1)}
              >
                <Plus aria-hidden="true" className="size-4" />
              </Button>
              <span>
                Reference total:{" "}
                <strong className="tabular-nums">
                  {formatBdt(unitPrice * effectiveQuantity)}
                </strong>
              </span>
            </div>
          )}
        </div>
      </div>
      <Tabs defaultValue="information" className="gap-0">
        <TabsList className="h-auto w-full justify-start gap-2 overflow-x-auto rounded-none border-y bg-transparent px-4">
          <TabsTrigger value="information" className="py-3">
            Product Information
          </TabsTrigger>
          <TabsTrigger value="description" className="py-3">
            Description
          </TabsTrigger>
          <TabsTrigger value="reviews" className="py-3">
            Reviews
          </TabsTrigger>
        </TabsList>
        <TabsContent value="information" className="mt-0">
          <DetailSection title="Product Information">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              {[
                ["Product ID", priceProductDisplayId(product.id)],
                ["Category", product.category?.name ?? "—"],
                ["Sub Category", product.subCategory?.name ?? "—"],
                ["Product Name", product.name],
                ["Variant", selected?.variantName ?? "—"],
                ["Inventory Unit", selected?.operationalUnit ?? "—"],
                ["Brand", selected?.brandDisplay ?? product.brand?.name ?? "—"],
                ["SKU", product.sku ?? "—"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="grid grid-cols-[110px_1fr] gap-2 border-b pb-2"
                >
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="break-words">{value}</dd>
                </div>
              ))}
            </dl>
          </DetailSection>
          <DetailSection title="Inventory & Product Rules">
            <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
              {rules.map(([label, value]) => (
                <div key={label}>
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="mt-1 font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </DetailSection>
          <DetailSection title="Performance">
            <p className="text-sm">
              {amount(detail.performance.orders)} delivered marketplace orders ·
              Item sales {formatBdt(detail.performance.sales)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Recorded across matching catalog variants. Counter sales and
              undelivered orders are excluded.
            </p>
          </DetailSection>
          <DetailSection title="Variant Stock & Purchase Prices" id="pricing">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <label htmlFor="price-owner" className="text-sm">
                Inventory owner
              </label>
              <select
                id="price-owner"
                value={effectiveOwner}
                onChange={(event) => setOwner(event.target.value)}
                className="max-w-full rounded-md border bg-card px-3 py-2 text-sm"
              >
                <option value="all">All owners</option>
                {[...owners].map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <p className="mb-3 text-sm text-muted-foreground">
              Showing {selected?.variantName ?? "this product"}. Stock and
              purchase costs belong to the named owner.
            </p>
            <DataTable
              headings={[
                "Owner",
                "Available",
                "Reserved",
                "Unit",
                "Owner Selling Price",
              ]}
            >
              {stock.map((row) => (
                <tr key={row.id}>
                  <td>
                    {row.ownerName}
                    <span className="block text-xs text-muted-foreground">
                      {row.ownerType}
                    </span>
                  </td>
                  <td>{amount(row.available)}</td>
                  <td>{amount(row.reserved)}</td>
                  <td>{row.unit}</td>
                  <td>
                    {row.sellingPrice == null
                      ? "—"
                      : formatBdt(row.sellingPrice)}
                  </td>
                </tr>
              ))}
            </DataTable>
            {!stock.length && (
              <p className="py-4 text-sm text-muted-foreground">
                No recorded inventory for this variant and owner.
              </p>
            )}
            {detail.stockHasMore && (
              <p className="mt-2 text-xs text-muted-foreground">
                Showing the 200 most recently updated inventory records for this
                product.
              </p>
            )}
            <h3 className="mb-2 mt-6 text-sm font-semibold">
              Recorded Purchase Costs
            </h3>
            <p className="mb-3 text-xs text-muted-foreground">
              Recent received purchases and stock entries, newest first. Each
              amount retains its recorded unit and New/Exchange mode; it is not
              an average cost.
            </p>
            <DataTable
              headings={[
                "Owner",
                "Purchase Price",
                "Basis",
                "Type",
                "Reference",
                "Recorded",
              ]}
            >
              {receipts.map((row) => (
                <tr key={row.key}>
                  <td>{row.ownerName}</td>
                  <td>{formatBdt(row.unitCost)}</td>
                  <td>per {row.unit}</td>
                  <td className="capitalize">{row.mode ?? "Not recorded"}</td>
                  <td>
                    {row.reference ?? row.source}
                    <span className="block text-xs text-muted-foreground">
                      {row.source}
                    </span>
                  </td>
                  <td>{dateLabel(row.recordedAt)}</td>
                </tr>
              ))}
            </DataTable>
            {!receipts.length && (
              <p className="py-4 text-sm text-muted-foreground">
                No purchase cost has been recorded for this variant and owner.
              </p>
            )}
            {detail.receiptsHasMore && (
              <p className="mt-2 text-xs text-muted-foreground">
                Showing the 200 most recent cost records for this product.
              </p>
            )}
            <h3 className="mb-2 mt-6 text-sm font-semibold">
              Reference Pricing
            </h3>
            <DataTable
              headings={[
                "Variant",
                "Exchange Price",
                "Price / New Cylinder Price",
              ]}
            >
              {detail.prices.map((row) => (
                <tr key={row.variantPriceId}>
                  <td>
                    <button
                      className="text-primary underline-offset-4 hover:underline"
                      onClick={() => changeVariant(row.variantPriceId)}
                    >
                      {row.variantName}
                    </button>
                  </td>
                  <td>
                    {row.exchangePrice == null
                      ? "—"
                      : formatBdt(row.exchangePrice)}
                  </td>
                  <td>{formatBdt(row.consumerPrice)}</td>
                </tr>
              ))}
            </DataTable>
          </DetailSection>
          <DetailSection title="Product History">
            <p className="mb-4 text-sm">
              Created: {dateLabel(product.createdAt)} · Product updated:{" "}
              {dateLabel(product.updatedAt)}
            </p>
            <DataTable
              headings={[
                "Variant",
                "Price Change",
                "Exchange Change",
                "User ID",
                "Date",
              ]}
            >
              {detail.history.map((row) => (
                <tr key={row.id}>
                  <td>
                    {detail.prices.find(
                      (price) => price.variantPriceId === row.variantPriceId,
                    )?.variantValue ?? "Previous variant"}
                  </td>
                  <td>
                    {formatBdt(row.previousPrice)} → {formatBdt(row.newPrice)}
                  </td>
                  <td>
                    {row.previousExchangePrice == null
                      ? "—"
                      : formatBdt(row.previousExchangePrice)}{" "}
                    →{" "}
                    {row.newExchangePrice == null
                      ? "—"
                      : formatBdt(row.newExchangePrice)}
                  </td>
                  <td title={row.actorId}>{row.actorId.slice(-5)}</td>
                  <td>{dateLabel(row.createdAt)}</td>
                </tr>
              ))}
            </DataTable>
            {!detail.history.length && (
              <p className="mt-3 text-sm text-muted-foreground">
                No price changes recorded yet.
              </p>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              Latest 20 price changes.
            </p>
          </DetailSection>
        </TabsContent>
        <TabsContent value="description" className="m-0">
          <DetailSection title="Description">
            {product.shortDescription && (
              <p className="mb-4 text-sm">{product.shortDescription}</p>
            )}
            {product.description ? (
              <RichTextContent content={product.description} />
            ) : (
              !product.shortDescription && (
                <p className="text-sm text-muted-foreground">
                  No description has been added.
                </p>
              )
            )}
            {product.features?.map((group) => (
              <div key={group.title} className="mt-5">
                <h3 className="mb-2 font-semibold">{group.title}</h3>
                <dl className="space-y-2 text-sm">
                  {group.items.map((item) => (
                    <div key={item.key} className="flex gap-2">
                      <dt className="text-muted-foreground">{item.key}:</dt>
                      <dd>{item.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </DetailSection>
        </TabsContent>
        <TabsContent value="reviews" className="m-0">
          <DetailSection title="Reviews">
            {reviewsQuery.isPending ? (
              <p role="status">Loading reviews…</p>
            ) : reviewsQuery.isError ? (
              <p role="alert">
                Reviews could not be loaded.{" "}
                <button
                  className="underline"
                  onClick={() => void reviewsQuery.refetch()}
                >
                  Try again
                </button>
              </p>
            ) : (
              <>
                <p className="mb-4 text-sm">
                  {reviewsQuery.data?.stats.averageRating.toFixed(1) ?? "0.0"} /
                  5 · {reviewsQuery.data?.stats.totalReviews ?? 0} reviews
                </p>
                {reviewsQuery.data?.reviews.map((review) => (
                  <article key={review.id} className="border-t py-4 text-sm">
                    <p className="font-semibold">
                      {review.user?.name ?? "Customer"} · {review.rating} / 5
                    </p>
                    {review.title && (
                      <p className="mt-2 font-medium">{review.title}</p>
                    )}
                    <p className="mt-1 whitespace-pre-wrap">{review.comment}</p>
                  </article>
                ))}
                {!reviewsQuery.data?.reviews.length && (
                  <p className="text-sm text-muted-foreground">
                    No reviews yet.
                  </p>
                )}
              </>
            )}
          </DetailSection>
        </TabsContent>
      </Tabs>
      {detail.related.length > 0 && (
        <DetailSection title="Related Products">
          <div className="grid gap-4 sm:grid-cols-2">
            {detail.related.map((item) => (
              <Link
                key={item.id}
                href={`${ROUTE}/${item.id}?${new URLSearchParams({ returnTo })}`}
                className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/30"
              >
                {item.image && (
                  <Image
                    src={item.image}
                    alt=""
                    width={72}
                    height={72}
                    unoptimized
                    className="size-18 rounded object-contain"
                  />
                )}
                <span className="text-sm font-semibold">{item.name}</span>
              </Link>
            ))}
          </div>
        </DetailSection>
      )}
    </div>
  );
}

function DetailSection({
  title,
  id,
  children,
}: {
  title: string;
  id?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="border-t p-4 md:p-5">
      <h2 className="mb-4 text-base font-bold">{title}</h2>
      {children}
    </section>
  );
}
function DataTable({
  headings,
  children,
}: {
  headings: string[];
  children: ReactNode;
}) {
  return (
    <div className="max-w-full overflow-x-auto">
      <table className={styles.dataTable}>
        <thead>
          <tr>
            {headings.map((heading) => (
              <th key={heading} scope="col">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
