"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Minus, Plus, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CylinderTypeRadios } from "@/components/features/products/cylinder-type-radios";
import { ProductSpecs } from "@/components/features/products/product-specs";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import {
  getWarehouseStorefrontCartKey,
  mergeWarehouseStorefrontCart,
  readWarehouseStorefrontCart,
  type WarehouseStorefrontCartItem,
  type WarehouseStorefrontOrderMode,
  type WarehouseStorefrontSaleMode,
  writeWarehouseStorefrontCart,
} from "@/lib/warehouse-storefront-cart";
import type {
  WarehouseStorefrontDetailVariant,
  WarehouseStorefrontProductDetail,
} from "@/types/warehouse-storefront";
import { orpc } from "@/utils/orpc";

type WarehouseBuyerMode = "default" | "retailer" | "w2w" | "view-only";

interface WarehouseProductDetailActionsProps {
  product: WarehouseStorefrontProductDetail;
  warehouseSlug: string;
  storefrontPath: string;
  cartPath: string;
}

function toNumber(value: string | number | null | undefined, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getBuyerMode(
  role: string | undefined,
  isConnectedSupplier: boolean,
): WarehouseBuyerMode {
  if (role === "shop_owner") return "retailer";
  if (role === "warehouse") return isConnectedSupplier ? "w2w" : "view-only";
  return "default";
}

function getSpecsVariant(variant: WarehouseStorefrontDetailVariant) {
  return {
    id: variant.id,
    unitLabel: variant.unitLabel,
    weightKg: variant.weightKg == null ? null : String(variant.weightKg),
    packagingType: variant.packagingType,
    origin: variant.origin,
    shelfLife: variant.shelfLife,
    orderMin: variant.orderMin == null ? null : String(variant.orderMin),
    orderUnit: variant.orderUnit,
    quantitySelectorOptions: variant.quantitySelectorOptions,
    sortOrder: variant.sortOrder,
    sku: variant.sku,
  };
}

export function WarehouseProductDetailActions({
  product,
  warehouseSlug,
  storefrontPath,
  cartPath,
}: WarehouseProductDetailActionsProps) {
  const { data: sessionData, isPending: sessionPending } =
    authClient.useSession();
  const role = sessionData?.user?.role as string | undefined;
  const isWarehouseBuyer = role === "warehouse";

  const { data: supplierConnections, isLoading: connectionsLoading } = useQuery(
    {
      ...orpc.warehouse.getMyWarehouseSuppliers.queryOptions({
        input: { status: "active", search: warehouseSlug, page: 1, limit: 10 },
      }),
      enabled: isWarehouseBuyer,
    },
  );

  const activeConnection = supplierConnections?.items?.find(
    (item: any) =>
      item.warehouseSlug === warehouseSlug ||
      item.warehouseId === warehouseSlug,
  );
  const isConnectedSupplier = Boolean(activeConnection);
  const mode = getBuyerMode(role, isConnectedSupplier);
  const orderMode: WarehouseStorefrontOrderMode | null =
    mode === "retailer" || mode === "w2w" ? mode : null;
  const storageKey = orderMode
    ? getWarehouseStorefrontCartKey(
        orderMode,
        sessionData?.user?.id,
        warehouseSlug,
      )
    : null;

  const [cart, setCart] = useState<WarehouseStorefrontCartItem[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState(
    product.variants[0]?.id ?? -1,
  );
  const [quantity, setQuantity] = useState(1);
  const [saleMode, setSaleMode] = useState<WarehouseStorefrontSaleMode>(
    product.variants[0]?.cylinderSale?.defaultMode ?? "new",
  );

  const selectedVariant = useMemo(
    () =>
      product.variants.find((variant) => variant.id === selectedVariantId) ??
      product.variants[0] ??
      null,
    [product.variants, selectedVariantId],
  );

  const minimumOrder = Math.max(1, toNumber(selectedVariant?.orderMin, 1));
  const orderIncrement = Math.max(
    1,
    toNumber(selectedVariant?.orderIncrement, 1),
  );
  const availableQty = Math.max(0, toNumber(selectedVariant?.availableQty));
  const configuredMaximumOrder = toNumber(selectedVariant?.orderMax);
  const maximumSelectableQuantity =
    availableQty > 0
      ? Math.min(
          availableQty,
          configuredMaximumOrder > 0 ? configuredMaximumOrder : availableQty,
        )
      : 0;
  const canExchange = Boolean(selectedVariant?.canExchange);
  const effectiveSaleMode: WarehouseStorefrontSaleMode =
    mode === "retailer" && canExchange ? saleMode : "new";
  const minimumSelectableQuantity = Math.min(
    minimumOrder,
    maximumSelectableQuantity > 0 ? maximumSelectableQuantity : minimumOrder,
  );
  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);

  useEffect(() => {
    setCart(readWarehouseStorefrontCart(storageKey));
  }, [storageKey]);

  useEffect(() => {
    const nextVariant =
      product.variants.find((variant) => variant.id === selectedVariantId) ??
      product.variants[0] ??
      null;
    const nextMinimum = Math.min(
      minimumOrder,
      maximumSelectableQuantity > 0 ? maximumSelectableQuantity : minimumOrder,
    );
    setQuantity(nextMinimum);
    setSaleMode(nextVariant?.cylinderSale?.defaultMode ?? "new");
  }, [
    minimumOrder,
    maximumSelectableQuantity,
    product.variants,
    selectedVariantId,
  ]);

  const adjustQuantity = (delta: number) => {
    setQuantity((current) =>
      Math.max(
        minimumSelectableQuantity,
        Math.min(maximumSelectableQuantity, current + delta),
      ),
    );
  };

  const handleAddToCart = () => {
    if (!selectedVariant || !storageKey || !orderMode) return;

    const quantityToAdd = Math.max(
      minimumSelectableQuantity,
      Math.min(maximumSelectableQuantity, quantity),
    );
    const item: Omit<WarehouseStorefrontCartItem, "quantity"> = {
      variantId: selectedVariant.id,
      inventoryId: selectedVariant.inventoryId,
      productName: product.name,
      image: product.image,
      sku: selectedVariant.sku ?? "",
      unitLabel:
        selectedVariant.unitLabel || selectedVariant.quantitySelectorLabel,
      price: String(selectedVariant.retailPrice),
      availableQty,
      fulfillmentMode: selectedVariant.fulfillmentMode,
      supplyMode: selectedVariant.fulfillmentMode,
      targetVariantId: selectedVariant.targetVariantId ?? null,
      canExchange: mode === "retailer" && canExchange,
      cylinderSaleMode: effectiveSaleMode,
    };
    const nextCart = mergeWarehouseStorefrontCart(
      cart,
      item,
      quantityToAdd,
      quantityToAdd,
    );
    setCart(nextCart);
    writeWarehouseStorefrontCart(storageKey, nextCart);
    toast.success(`Added ${product.name} to cart`);
  };

  if (sessionPending || (isWarehouseBuyer && connectionsLoading)) {
    return <div className="h-48 animate-pulse rounded-lg bg-gray-100" />;
  }

  if (mode === "view-only") {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
          <p className="font-semibold">Supplier connection required</p>
          <p className="text-amber-800">
            Connect with this warehouse before ordering its products.
          </p>
        </div>
        <Button
          asChild
          variant="outline"
          className="h-12 w-full border-amber-300 bg-white text-amber-900 hover:bg-amber-50"
        >
          <Link href="/warehouse/dashboard/suppliers">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Open supplier connections
          </Link>
        </Button>
      </div>
    );
  }

  if (mode === "default") {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-950">
          Log in as a retailer or connected warehouse buyer to order from this
          storefront.
        </div>
        <Button asChild className="h-12 w-full">
          <Link href="/login">Log in to order</Link>
        </Button>
      </div>
    );
  }

  if (!selectedVariant) return null;

  return (
    <div className="flex flex-col">
      <div className="mb-4 flex items-baseline gap-2">
        <span className="text-3xl font-bold text-gray-900">
          ৳{selectedVariant.retailPrice.toLocaleString("en-BD")}
        </span>
        <span className="text-sm text-gray-500">
          / {selectedVariant.unitLabel}
        </span>
      </div>

      {product.variants.length > 1 && (
        <div className="mb-6">
          <span className="mb-2 block text-sm font-medium text-gray-700">
            Select Variant
          </span>
          <div className="flex flex-wrap gap-2">
            {product.variants.map((variant) => {
              const active = variant.id === selectedVariant.id;
              return (
                <button
                  key={variant.id}
                  type="button"
                  onClick={() => setSelectedVariantId(variant.id)}
                  className={`rounded-lg border-2 px-4 py-2.5 text-left text-sm font-medium transition-all ${
                    active
                      ? "border-blue-600 bg-blue-50 text-blue-700 shadow-sm"
                      : "border-gray-200 bg-white text-gray-700 hover:border-blue-400 hover:bg-blue-50/50"
                  }`}
                >
                  <span className="block">
                    {variant.quantitySelectorLabel || variant.unitLabel}
                  </span>
                  <span className="mt-0.5 block text-xs">
                    ৳{variant.retailPrice.toLocaleString("en-BD")}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {mode === "retailer" && canExchange && (
        <div className="mb-6">
          <CylinderTypeRadios
            value={effectiveSaleMode}
            onChange={setSaleMode}
          />
          {selectedVariant.cylinderSale?.exchangeCreditAmount ? (
            <p className="mt-2 text-xs text-emerald-700">
              Exchange credit: ৳
              {selectedVariant.cylinderSale.exchangeCreditAmount.toLocaleString(
                "en-BD",
              )}{" "}
              each
            </p>
          ) : null}
        </div>
      )}

      <div className="mb-6">
        <ProductSpecs
          categoryName={product.category.name}
          brandName={product.brand?.name ?? null}
          productSize={product.size}
          subCategoryName={product.subCategory?.name ?? null}
          features={product.features}
          variants={[getSpecsVariant(selectedVariant)]}
        />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <span className="block text-xs text-gray-500">Minimum order</span>
          <span className="mt-1 block font-mono text-sm font-semibold text-gray-900">
            {minimumOrder}{" "}
            {selectedVariant.orderUnit || selectedVariant.unitLabel}
          </span>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <span className="block text-xs text-gray-500">Available</span>
          <span className="mt-1 block font-mono text-sm font-semibold text-gray-900">
            {availableQty} {selectedVariant.unitLabel}
          </span>
        </div>
        {configuredMaximumOrder > 0 && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <span className="block text-xs text-gray-500">Max per order</span>
            <span className="mt-1 block font-mono text-sm font-semibold text-gray-900">
              {Math.min(configuredMaximumOrder, availableQty)}{" "}
              {selectedVariant.orderUnit || selectedVariant.unitLabel}
            </span>
          </div>
        )}
      </div>

      <div className="mb-4 flex items-center gap-4">
        <span className="font-medium text-gray-600">Quantity:</span>
        <div className="flex items-center rounded-lg border">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-r-none"
            onClick={() => adjustQuantity(-orderIncrement)}
            disabled={quantity <= minimumSelectableQuantity}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <span className="w-16 text-center font-mono font-medium tabular-nums">
            {quantity}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-l-none"
            onClick={() => adjustQuantity(orderIncrement)}
            disabled={quantity >= maximumSelectableQuantity}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Button
        type="button"
        className={`h-12 w-full text-base ${
          mode === "w2w"
            ? "bg-emerald-600 hover:bg-emerald-700"
            : "bg-blue-600 hover:bg-blue-700"
        }`}
        onClick={handleAddToCart}
        disabled={
          availableQty <= 0 ||
          quantity < minimumSelectableQuantity ||
          quantity > maximumSelectableQuantity
        }
      >
        <ShoppingCart className="mr-2 h-5 w-5" />
        Add to existing cart
      </Button>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
        <Link
          href={storefrontPath}
          className="inline-flex items-center text-gray-600 hover:text-gray-900 hover:underline"
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Back to storefront
        </Link>
        {cartCount > 0 && (
          <Link
            href={cartPath}
            className="font-semibold text-blue-700 hover:text-blue-800 hover:underline"
          >
            View cart ({cartCount} units)
          </Link>
        )}
      </div>
    </div>
  );
}
