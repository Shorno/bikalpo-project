"use client";

import { Loader2, Minus, Package, Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { StorefrontProduct } from "@/components/storefront/storefront-product-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CartItem } from "@/hooks/use-orpc-cart";
import styles from "./catalog-product-card.module.css";
import {
  type CylinderSaleMode,
  shortVariantLabel,
} from "./cylinder-type-radios";

interface CatalogProductCardProps {
  product: StorefrontProduct;
  detailHref: string;
  image: string;
  selectedVariant: StorefrontProduct["variants"][number] | undefined;
  selectedPrice: number;
  cylinderSaleMode: CylinderSaleMode;
  canExchange: boolean;
  cartItem?: CartItem;
  isAdding: boolean;
  addDisabled: boolean;
  quantityDisabled: boolean;
  increaseDisabled: boolean;
  onVariantChange: (variantId: number) => void;
  onSaleModeChange: (mode: CylinderSaleMode) => void;
  onAdd: () => void;
  onQuantityChange: (quantity: number) => void;
}

/** The client's compact landing card; selection and cart state stay in the shared card. */
export function CatalogProductCard({
  product,
  detailHref,
  image,
  selectedVariant,
  selectedPrice,
  cylinderSaleMode,
  canExchange,
  cartItem,
  isAdding,
  addDisabled,
  quantityDisabled,
  increaseDisabled,
  onVariantChange,
  onSaleModeChange,
  onAdd,
  onQuantityChange,
}: CatalogProductCardProps) {
  const [variantChosen, setVariantChosen] = useState(false);
  const [saleModeChosen, setSaleModeChosen] = useState(false);
  const isCylinder =
    product.variants.some(
      (variant) => variant.canExchange || variant.exchangeEnabled,
    ) ||
    [product.category?.slug, product.subCategory?.slug].some(
      (slug) => slug === "lpg" || slug === "industrial-lpg",
    );
  const variantLabel = isCylinder ? "Size" : "Pack";
  const unit = selectedVariant?.unitLabel
    ? shortVariantLabel(selectedVariant.unitLabel, product.name)
    : null;
  const variantSelect = (
    <Select
      value={variantChosen ? String(selectedVariant?.variantId ?? "") : ""}
      onValueChange={(value) => {
        setVariantChosen(true);
        onVariantChange(Number(value));
      }}
      disabled={product.variants.length === 0}
    >
      <SelectTrigger
        className={styles.select}
        aria-label={`${variantLabel} for ${product.name}`}
      >
        <SelectValue placeholder={variantLabel} />
      </SelectTrigger>
      <SelectContent>
        {product.variants.map((variant) => (
          <SelectItem key={variant.variantId} value={String(variant.variantId)}>
            {shortVariantLabel(
              variant.quantitySelectorLabel ||
                variant.unitLabel ||
                variant.sku ||
                `Option ${variant.variantId}`,
              product.name,
            )}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <Card className={`gap-0 py-0 ring-0 ${styles.card}`}>
      <div className={styles.image}>
        <Link
          href={detailHref}
          className={styles.imageLink}
          aria-label={product.name}
        >
          {image ? (
            <Image
              src={image}
              alt={product.name}
              fill
              sizes="(max-width: 800px) 50vw, 20vw"
              className="object-cover"
            />
          ) : (
            <span className={styles.emptyImage}>
              <Package className="size-10" aria-hidden="true" />
              <span className="sr-only">No product image available</span>
            </span>
          )}
        </Link>
        {cartItem ? (
          <div
            className={styles.quantity}
            role="group"
            aria-label={`Quantity for ${product.name}`}
          >
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={styles.quantityButton}
              disabled={quantityDisabled}
              onClick={() => onQuantityChange(cartItem.quantity - 1)}
              aria-label={`Decrease ${product.name} quantity`}
            >
              <Minus aria-hidden="true" />
            </Button>
            <span aria-live="polite">{cartItem.quantity}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={styles.quantityButton}
              disabled={quantityDisabled || increaseDisabled}
              onClick={() => onQuantityChange(cartItem.quantity + 1)}
              aria-label={`Increase ${product.name} quantity`}
            >
              <Plus aria-hidden="true" />
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={styles.add}
            disabled={addDisabled}
            onClick={onAdd}
            aria-label={
              isAdding
                ? `Adding ${product.name} to cart`
                : `Add ${product.name} to cart`
            }
          >
            {isAdding ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <Plus aria-hidden="true" />
            )}
          </Button>
        )}
      </div>
      <div className={styles.body}>
        <Link href={detailHref} className={styles.nameLink}>
          <h2 className={styles.name} title={product.name}>
            <span className={styles.nameText}>{product.name}</span>
          </h2>
        </Link>
        <div className={styles.priceLine}>
          <span className={styles.price}>
            ৳{selectedPrice.toLocaleString("en-BD")}
          </span>
          {unit ? <span className={styles.unit}>/ {unit}</span> : null}
        </div>
        <div className={styles.selects}>
          {isCylinder ? (
            variantSelect
          ) : (
            <Select disabled={!product.brand?.name}>
              <SelectTrigger
                className={styles.select}
                aria-label={`Brand for ${product.name}`}
              >
                <SelectValue placeholder="Brand" />
              </SelectTrigger>
              <SelectContent>
                {product.brand?.name ? (
                  <SelectItem value={product.brand.name}>
                    {product.brand.name}
                  </SelectItem>
                ) : null}
              </SelectContent>
            </Select>
          )}
          {isCylinder ? (
            <Select
              value={saleModeChosen ? cylinderSaleMode : ""}
              onValueChange={(value) => {
                setSaleModeChosen(true);
                onSaleModeChange(value as CylinderSaleMode);
              }}
              disabled={!selectedVariant}
            >
              <SelectTrigger
                className={styles.select}
                aria-label={`Type for ${product.name}`}
              >
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                {canExchange ? (
                  <SelectItem value="exchange">Exchange</SelectItem>
                ) : null}
                <SelectItem value="new">New</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            variantSelect
          )}
        </div>
      </div>
    </Card>
  );
}
