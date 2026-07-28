"use client";

import {
  Banknote,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { CartRetailerLabel } from "@/components/layout/cart-retailer-label";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { CartItem } from "@/hooks/use-orpc-cart";
import { getCartItemProductHref } from "@/lib/retailer-storefront-url";
import { cn } from "@/lib/utils";

export function formatCheckoutPrice(price: number) {
  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    minimumFractionDigits: 0,
  }).format(price);
}

interface CheckoutSummaryProps {
  cartLoading: boolean;
  isOpenOrder: boolean;
  isPending: boolean;
  items: CartItem[];
  modeValid: boolean;
  onOpenChange?: (open: boolean) => void;
  onRemoveItem: (cartItemId: number) => Promise<void>;
  onUpdateQuantity: (cartItemId: number, quantity: number) => Promise<void>;
  open?: boolean;
  presentation: "desktop" | "compact";
  shippingCost: number;
  totalItems: number;
  totalPrice: number;
}

function CheckoutLineItem({
  cartLoading,
  item,
  onRemoveItem,
  onUpdateQuantity,
}: {
  cartLoading: boolean;
  item: CartItem;
  onRemoveItem: (cartItemId: number) => Promise<void>;
  onUpdateQuantity: (cartItemId: number, quantity: number) => Promise<void>;
}) {
  const productHref = getCartItemProductHref({
    shopSlug: item.shopSlug,
    productSlug: item.slug,
    categorySlug: item.categorySlug,
  });

  return (
    <div className="flex min-w-0 gap-3 py-3 first:pt-0 last:pb-0">
      <div className="relative size-14 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
        <Image
          src={item.image || "/placeholder-image.svg"}
          alt={item.name || "Product"}
          fill
          className="object-contain p-1.5"
          sizes="56px"
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              href={productHref}
              className="line-clamp-2 text-sm font-semibold leading-5 text-slate-900 outline-none hover:text-emerald-700 focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-emerald-600/40"
            >
              {item.name}
            </Link>
            <p className="mt-0.5 text-xs text-slate-500">{item.size}</p>
            {item.shopName && (
              <CartRetailerLabel
                className="mt-1.5"
                shopName={item.shopName}
              />
            )}
          </div>
          <p className="shrink-0 whitespace-nowrap text-sm font-semibold tabular-nums text-slate-900">
            {formatCheckoutPrice(item.price * item.quantity)}
          </p>
        </div>

        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white shadow-sm">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="size-8 rounded-r-none text-slate-600 hover:bg-slate-100"
              onClick={() => void onUpdateQuantity(item.id, item.quantity - 1)}
              disabled={item.quantity <= 1 || cartLoading}
              aria-label={`Decrease quantity of ${item.name}`}
            >
              <Minus aria-hidden="true" />
            </Button>
            <span className="w-8 text-center text-xs font-semibold tabular-nums text-slate-800">
              {item.quantity}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="size-8 rounded-l-none text-slate-600 hover:bg-slate-100"
              onClick={() => void onUpdateQuantity(item.id, item.quantity + 1)}
              disabled={cartLoading}
              aria-label={`Increase quantity of ${item.name}`}
            >
              <Plus aria-hidden="true" />
            </Button>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-8 text-slate-400 hover:bg-red-50 hover:text-red-600"
            onClick={() => void onRemoveItem(item.id)}
            disabled={cartLoading}
            aria-label={`Remove ${item.name} from cart`}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function CheckoutSummaryBody({
  cartLoading,
  isOpenOrder,
  isPending,
  items,
  modeValid,
  onRemoveItem,
  onUpdateQuantity,
  shippingCost,
  showAction,
  totalPrice,
}: Omit<
  CheckoutSummaryProps,
  "onOpenChange" | "open" | "presentation" | "totalItems"
> & { showAction: boolean }) {
  const payableTotal = isOpenOrder ? totalPrice : totalPrice + shippingCost;

  return (
    <div className="space-y-5">
      <div className="thin-scrollbar max-h-[min(45vh,28rem)] divide-y divide-slate-100 overflow-y-auto pr-1">
        {items.map((item) => (
          <CheckoutLineItem
            key={item.id}
            item={item}
            cartLoading={cartLoading}
            onUpdateQuantity={onUpdateQuantity}
            onRemoveItem={onRemoveItem}
          />
        ))}
      </div>

      <div
        className={cn(
          "rounded-xl border p-4",
          isOpenOrder
            ? "border-emerald-200 bg-emerald-50/70"
            : "border-slate-200 bg-slate-50",
        )}
      >
        <div className="space-y-2.5 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-600">
              {isOpenOrder ? "Reference subtotal" : "Subtotal"}
            </span>
            <span className="font-medium tabular-nums text-slate-900">
              {formatCheckoutPrice(totalPrice)}
            </span>
          </div>
          {!isOpenOrder && (
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-600">Delivery</span>
              <span className="font-medium tabular-nums text-slate-900">
                {shippingCost === 0
                  ? "Free"
                  : formatCheckoutPrice(shippingCost)}
              </span>
            </div>
          )}
        </div>

        <div className="my-3 h-px bg-slate-200/80" />

        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
              {isOpenOrder ? "Reference estimate" : "Order total"}
            </p>
            {isOpenOrder && (
              <p className="mt-1 max-w-52 text-xs leading-5 text-slate-600">
                Retailer offers determine your final payable amount.
              </p>
            )}
          </div>
          <span
            className={cn(
              "text-xl font-bold tracking-tight tabular-nums",
              isOpenOrder ? "text-emerald-700" : "text-slate-950",
            )}
          >
            {formatCheckoutPrice(payableTotal)}
          </span>
        </div>
      </div>

      {showAction && (
        <div className="space-y-3">
          <Button
            type="submit"
            size="lg"
            className="h-12 w-full bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 focus-visible:ring-emerald-600/30"
            disabled={isPending || !modeValid}
          >
            {isPending ? (
              <>
                <Loader2 className="animate-spin" aria-hidden="true" />
                {isOpenOrder ? "Checking nearby stock…" : "Processing…"}
              </>
            ) : (
              <>
                {isOpenOrder ? (
                  <Search aria-hidden="true" />
                ) : (
                  <CheckCircle2 aria-hidden="true" />
                )}
                {isOpenOrder
                  ? "Request offers from nearby retailers"
                  : "Place order"}
              </>
            )}
          </Button>

          <div className="flex items-start justify-center gap-2 text-center text-xs leading-5 text-slate-500">
            {isOpenOrder && (
              <Banknote
                className="mt-0.5 size-3.5 shrink-0 text-emerald-600"
                aria-hidden="true"
              />
            )}
            <p>
              {isOpenOrder
                ? "No payment now. Pay cash on delivery after accepting an offer."
                : "By placing this order, you agree to our terms."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export function CheckoutSummary(props: CheckoutSummaryProps) {
  const total = props.isOpenOrder
    ? props.totalPrice
    : props.totalPrice + props.shippingCost;

  if (props.presentation === "compact") {
    return (
      <Collapsible open={props.open} onOpenChange={props.onOpenChange}>
        <Card className="gap-0 overflow-hidden rounded-2xl border border-slate-200 bg-white py-0 shadow-sm ring-0">
          <CollapsibleTrigger className="flex min-h-16 w-full items-center justify-between gap-4 px-4 py-3 text-left outline-none transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600/40">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <ShoppingBag className="size-4" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-900">
                  Order summary
                </span>
                <span className="block text-xs text-slate-500">
                  {props.totalItems} {props.totalItems === 1 ? "item" : "items"}
                </span>
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-sm font-bold tabular-nums text-emerald-700">
                {formatCheckoutPrice(total)}
              </span>
              <ChevronDown
                className={cn(
                  "size-4 text-slate-400 transition-transform motion-reduce:transition-none",
                  props.open && "rotate-180",
                )}
                aria-hidden="true"
              />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="border-t border-slate-100 px-4 py-4">
              <CheckoutSummaryBody {...props} showAction={false} />
            </div>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    );
  }

  return (
    <Card className="sticky top-24 gap-0 overflow-hidden rounded-2xl border border-slate-200 bg-white py-0 shadow-[0_18px_50px_-32px_rgba(15,23,42,0.35)] ring-0">
      <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
        <div>
          <p className="text-base font-semibold text-slate-950">
            Order summary
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            Review quantities before continuing
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold tabular-nums text-slate-600">
          {props.totalItems} {props.totalItems === 1 ? "item" : "items"}
        </span>
      </div>
      <div className="px-5 py-5">
        <CheckoutSummaryBody {...props} showAction />
      </div>
    </Card>
  );
}
