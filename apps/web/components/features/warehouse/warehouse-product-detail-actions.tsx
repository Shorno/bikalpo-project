"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Minus, Plus, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import {
  getWarehouseStorefrontCartKey,
  mergeWarehouseStorefrontCart,
  readWarehouseStorefrontCart,
  resolveWarehouseStorefrontBuyerContext,
  type WarehouseStorefrontCartItem,
  type WarehouseStorefrontSaleMode,
  writeWarehouseStorefrontCart,
} from "@/lib/warehouse-storefront-cart";
import type { WarehouseStorefrontProductDetail } from "@/types/warehouse-storefront";
import { orpc } from "@/utils/orpc";

interface WarehouseProductDetailActionsProps {
  product: WarehouseStorefrontProductDetail;
  warehouseSlug: string;
  cartPath: string;
  selectedVariantId: number;
  cylinderSaleMode: WarehouseStorefrontSaleMode;
  onExchangeAvailabilityChange: (allowed: boolean) => void;
}

function toNumber(value: string | number | null | undefined, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function WarehouseProductDetailActions({
  product,
  warehouseSlug,
  cartPath,
  selectedVariantId,
  cylinderSaleMode,
  onExchangeAvailabilityChange,
}: WarehouseProductDetailActionsProps) {
  const { data: sessionData, isPending: sessionPending } =
    authClient.useSession();
  const [mounted, setMounted] = useState(false);
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
  const { viewMode, orderMode } = resolveWarehouseStorefrontBuyerContext(
    role,
    Boolean(activeConnection),
  );
  const storageKey = orderMode
    ? getWarehouseStorefrontCartKey(
        orderMode,
        sessionData?.user?.id,
        warehouseSlug,
      )
    : null;
  const [cart, setCart] = useState<WarehouseStorefrontCartItem[]>([]);
  const [quantity, setQuantity] = useState(1);
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
  const minimumSelectableQuantity = Math.min(
    minimumOrder,
    maximumSelectableQuantity > 0 ? maximumSelectableQuantity : minimumOrder,
  );
  const canExchange = Boolean(selectedVariant?.canExchange);
  const effectiveSaleMode: WarehouseStorefrontSaleMode =
    viewMode === "shop-owner" && canExchange ? cylinderSaleMode : "new";
  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setCart(readWarehouseStorefrontCart(storageKey));
  }, [storageKey]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: changing to another exact variant must reset quantity even when both variants share the same minimum
  useEffect(() => {
    setQuantity(minimumSelectableQuantity);
  }, [minimumSelectableQuantity, selectedVariantId]);

  useEffect(() => {
    onExchangeAvailabilityChange(viewMode === "shop-owner" && canExchange);
  }, [canExchange, onExchangeAvailabilityChange, viewMode]);

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
        selectedVariant.unitLabel ||
        selectedVariant.quantitySelectorLabel ||
        "Unit",
      price: String(selectedVariant.retailPrice),
      availableQty,
      fulfillmentMode: selectedVariant.fulfillmentMode,
      supplyMode: selectedVariant.fulfillmentMode,
      targetVariantId: selectedVariant.targetVariantId ?? null,
      canExchange: viewMode === "shop-owner" && canExchange,
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

  if (!mounted || sessionPending || (isWarehouseBuyer && connectionsLoading)) {
    return <div className="h-28 animate-pulse rounded-md bg-zinc-100" />;
  }

  if (viewMode === "view-only") {
    return (
      <div className="space-y-4">
        <div className="rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm leading-6 text-zinc-900">
          <p className="font-semibold">Supplier connection required</p>
          <p className="text-zinc-600">
            Connect with this warehouse before ordering its products.
          </p>
        </div>
        <Button asChild variant="outline" className="h-12 w-full">
          <Link href="/warehouse/dashboard/suppliers">
            <ArrowLeft className="mr-2 size-4" />
            Open supplier connections
          </Link>
        </Button>
      </div>
    );
  }

  if (viewMode === "login-only") {
    return (
      <div className="space-y-4">
        <div className="rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm leading-6 text-zinc-700">
          Log in as a Shop Owner or connected Warehouse Owner to order from this
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
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <span className="font-medium text-zinc-600">Quantity:</span>
        <div className="flex items-center rounded-lg border border-zinc-200">
          <Button
            aria-label="Decrease quantity"
            className="size-10 rounded-r-none"
            disabled={quantity <= minimumSelectableQuantity}
            onClick={() => adjustQuantity(-orderIncrement)}
            size="icon"
            type="button"
            variant="ghost"
          >
            <Minus className="size-4" />
          </Button>
          <span className="w-16 text-center font-mono font-medium tabular-nums">
            {quantity}
          </span>
          <Button
            aria-label="Increase quantity"
            className="size-10 rounded-l-none"
            disabled={quantity >= maximumSelectableQuantity}
            onClick={() => adjustQuantity(orderIncrement)}
            size="icon"
            type="button"
            variant="ghost"
          >
            <Plus className="size-4" />
          </Button>
        </div>
      </div>

      <div className="flex gap-3">
        <Button
          className="h-12 flex-1 text-base"
          disabled={
            availableQty <= 0 ||
            quantity < minimumSelectableQuantity ||
            quantity > maximumSelectableQuantity
          }
          onClick={handleAddToCart}
          type="button"
        >
          <ShoppingCart className="mr-2 size-5" />
          Add Cart
        </Button>
        <Button asChild className="h-12 px-5 text-base" variant="outline">
          <Link href={cartPath}>
            View cart{cartCount > 0 ? ` (${cartCount})` : ""}
          </Link>
        </Button>
      </div>
    </div>
  );
}
