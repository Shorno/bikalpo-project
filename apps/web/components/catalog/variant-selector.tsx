"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

interface VariantData {
  id: number;
  sku: string | null;
  unitLabel: string;
  weightKg: string;
  price: string;
  packType: string | null;
  packWeightKg: string | null;
  sellUnit: string | null;
  color: string | null;
  size: string | null;
  brandId: number | null;
  variantType: string | null;
  isPackReturnRequired: boolean | null;
  packDepositAmount: string | null;
  sortOrder: number;
  productId: number;
  productName: string;
  productImage: string | null;
  brand: { id: number; name: string } | null;
  innerPackSizeKg?: string | null;
  packCountInside?: number | null;
}

type VariantMode = "grocery" | "fashion" | "electronics" | "generic";

interface VariantSelectorProps {
  variants: VariantData[];
  selectedVariantId: number | null;
  onSelect: (variantId: number) => void;
}

// ────────────────────────────────────────────────────────────────
// Mode Detection
// ────────────────────────────────────────────────────────────────

function detectMode(variants: VariantData[]): VariantMode {
  const hasColor = variants.some((v) => v.color);
  const hasSize = variants.some((v) => v.size);
  const brandSet = new Set(variants.map((v) => v.brand?.id).filter(Boolean));
  const hasBrand = brandSet.size > 1;
  const hasWeight = variants.some((v) => Number(v.weightKg) > 0);
  const hasPackType = variants.some((v) => v.packType && v.packType !== "loose");

  if (hasColor && hasSize) return "fashion";
  if (hasColor && !hasSize) return "electronics";
  if (hasBrand && (hasWeight || hasPackType)) return "grocery";
  return "generic";
}

// ────────────────────────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────────────────────────

export function VariantSelector({ variants, selectedVariantId, onSelect }: VariantSelectorProps) {
  const mode = useMemo(() => detectMode(variants), [variants]);

  switch (mode) {
    case "grocery":
      return <GrocerySelector variants={variants} selectedVariantId={selectedVariantId} onSelect={onSelect} />;
    case "fashion":
      return <FashionSelector variants={variants} selectedVariantId={selectedVariantId} onSelect={onSelect} />;
    case "electronics":
      return <ElectronicsSelector variants={variants} selectedVariantId={selectedVariantId} onSelect={onSelect} />;
    default:
      return <GenericSelector variants={variants} selectedVariantId={selectedVariantId} onSelect={onSelect} />;
  }
}

// ────────────────────────────────────────────────────────────────
// Grocery Selector (Brand → Pack/Weight)
// ────────────────────────────────────────────────────────────────

function GrocerySelector({ variants, selectedVariantId, onSelect }: VariantSelectorProps) {
  const brands = useMemo(() => {
    const map = new Map<number, { id: number; name: string }>();
    for (const v of variants) {
      if (v.brand) map.set(v.brand.id, v.brand);
    }
    return Array.from(map.values());
  }, [variants]);

  const [selectedBrandId, setSelectedBrandId] = useState<number | null>(
    () => variants.find((v) => v.id === selectedVariantId)?.brand?.id ?? brands[0]?.id ?? null,
  );

  const brandVariants = useMemo(
    () => variants.filter((v) => v.brand?.id === selectedBrandId),
    [variants, selectedBrandId],
  );

  return (
    <div className="space-y-4">
      {/* Brand Selector */}
      {brands.length > 1 && (
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
            Select Brand
          </label>
          <div className="flex flex-wrap gap-2">
            {brands.map((b) => (
              <PillButton
                key={b.id}
                label={b.name}
                isActive={b.id === selectedBrandId}
                onClick={() => {
                  setSelectedBrandId(b.id);
                  const firstVariant = variants.find((v) => v.brand?.id === b.id);
                  if (firstVariant) onSelect(firstVariant.id);
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Pack/Weight Selector */}
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
          Select Pack
        </label>
        <div className="flex flex-wrap gap-2">
          {brandVariants.map((v) => {
            const label = v.unitLabel || `${v.weightKg}kg`;
            return (
              <PillButton
                key={v.id}
                label={label}
                sublabel={`৳${Number(v.price).toLocaleString("en-BD")}`}
                isActive={v.id === selectedVariantId}
                onClick={() => onSelect(v.id)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Fashion Selector (Color → Size)
// ────────────────────────────────────────────────────────────────

function FashionSelector({ variants, selectedVariantId, onSelect }: VariantSelectorProps) {
  const colors = useMemo(() => [...new Set(variants.map((v) => v.color).filter(Boolean))], [variants]);
  const sizes = useMemo(() => [...new Set(variants.map((v) => v.size).filter(Boolean))], [variants]);

  const selected = variants.find((v) => v.id === selectedVariantId);
  const [selectedColor, setSelectedColor] = useState<string | null>(selected?.color ?? colors[0] ?? null);
  const [selectedSize, setSelectedSize] = useState<string | null>(selected?.size ?? sizes[0] ?? null);

  const handleColorChange = (color: string) => {
    setSelectedColor(color);
    const match = variants.find((v) => v.color === color && v.size === selectedSize);
    if (match) onSelect(match.id);
    else {
      const fallback = variants.find((v) => v.color === color);
      if (fallback) {
        setSelectedSize(fallback.size);
        onSelect(fallback.id);
      }
    }
  };

  const handleSizeChange = (size: string) => {
    setSelectedSize(size);
    const match = variants.find((v) => v.color === selectedColor && v.size === size);
    if (match) onSelect(match.id);
    else {
      const fallback = variants.find((v) => v.size === size);
      if (fallback) {
        setSelectedColor(fallback.color);
        onSelect(fallback.id);
      }
    }
  };

  // Check if a color+size combo exists
  const isComboAvailable = (color: string, size: string) =>
    variants.some((v) => v.color === color && v.size === size);

  return (
    <div className="space-y-4">
      {/* Color Selector */}
      {colors.length > 0 && (
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
            Color
          </label>
          <div className="flex flex-wrap gap-2">
            {colors.map((color) => (
              <ColorSwatch
                key={color!}
                color={color!}
                isActive={color === selectedColor}
                onClick={() => handleColorChange(color!)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Size Selector */}
      {sizes.length > 0 && (
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
            Size
          </label>
          <div className="flex flex-wrap gap-2">
            {sizes.map((size) => {
              const available = selectedColor ? isComboAvailable(selectedColor, size!) : true;
              return (
                <PillButton
                  key={size!}
                  label={size!}
                  isActive={size === selectedSize}
                  disabled={!available}
                  onClick={() => handleSizeChange(size!)}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Electronics Selector (Color only or single dimension)
// ────────────────────────────────────────────────────────────────

function ElectronicsSelector({ variants, selectedVariantId, onSelect }: VariantSelectorProps) {
  const colors = useMemo(() => [...new Set(variants.map((v) => v.color).filter(Boolean))], [variants]);

  return (
    <div className="space-y-4">
      {colors.length > 0 && (
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
            Color
          </label>
          <div className="flex flex-wrap gap-2">
            {colors.map((color) => {
              const variant = variants.find((v) => v.color === color);
              return (
                <PillButton
                  key={color!}
                  label={color!}
                  sublabel={variant ? `৳${Number(variant.price).toLocaleString("en-BD")}` : undefined}
                  isActive={variant?.id === selectedVariantId}
                  onClick={() => variant && onSelect(variant.id)}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Generic Selector (Weight/Unit fallback)
// ────────────────────────────────────────────────────────────────

function GenericSelector({ variants, selectedVariantId, onSelect }: VariantSelectorProps) {
  return (
    <div>
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
        Select Variant
      </label>
      <div className="flex flex-wrap gap-2">
        {variants.map((v) => {
          const label = v.unitLabel || v.sellUnit || `${v.weightKg}kg`;
          return (
            <PillButton
              key={v.id}
              label={label}
              sublabel={`৳${Number(v.price).toLocaleString("en-BD")}`}
              isActive={v.id === selectedVariantId}
              onClick={() => onSelect(v.id)}
            />
          );
        })}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Shared UI Components
// ────────────────────────────────────────────────────────────────

function PillButton({
  label,
  sublabel,
  isActive,
  disabled,
  onClick,
}: {
  label: string;
  sublabel?: string;
  isActive: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "px-3.5 py-2 rounded-lg border text-sm font-medium transition-all duration-150",
        "flex flex-col items-center gap-0.5 min-w-[60px]",
        isActive
          ? "border-emerald-500 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500/30 shadow-sm"
          : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50",
        disabled && "opacity-40 cursor-not-allowed line-through",
      )}
    >
      <span>{label}</span>
      {sublabel && (
        <span className={cn("text-xs", isActive ? "text-emerald-600" : "text-gray-400")}>
          {sublabel}
        </span>
      )}
    </button>
  );
}

const COLOR_MAP: Record<string, string> = {
  black: "#000000",
  white: "#FFFFFF",
  red: "#EF4444",
  blue: "#3B82F6",
  green: "#22C55E",
  yellow: "#EAB308",
  orange: "#F97316",
  purple: "#A855F7",
  pink: "#EC4899",
  gray: "#6B7280",
  grey: "#6B7280",
  brown: "#92400E",
  navy: "#1E3A5F",
  maroon: "#7F1D1D",
  beige: "#D4C5A9",
  olive: "#6B8E23",
  teal: "#0D9488",
  cyan: "#06B6D4",
  gold: "#CA8A04",
  silver: "#9CA3AF",
};

function ColorSwatch({
  color,
  isActive,
  onClick,
}: {
  color: string;
  isActive: boolean;
  onClick: () => void;
}) {
  const hex = COLOR_MAP[color.toLowerCase()] || "#6B7280";
  const isLight = color.toLowerCase() === "white" || color.toLowerCase() === "beige";

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all duration-150",
        isActive
          ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500/30 shadow-sm"
          : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50",
      )}
    >
      <span
        className={cn(
          "w-5 h-5 rounded-full border-2 shrink-0",
          isActive ? "border-emerald-500" : "border-gray-300",
          isLight && "border-gray-300",
        )}
        style={{ backgroundColor: hex }}
      />
      <span className="capitalize">{color}</span>
    </button>
  );
}

// ────────────────────────────────────────────────────────────────
// Variant Info Display
// ────────────────────────────────────────────────────────────────

export function VariantInfoCard({ variant }: { variant: VariantData | undefined }) {
  if (!variant) return null;

  return (
    <div className="bg-gray-50 rounded-lg p-4 space-y-2">
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-gray-900">
          ৳{Number(variant.price).toLocaleString("en-BD")}
        </span>
        <span className="text-sm text-gray-500">per {variant.sellUnit || variant.unitLabel || "unit"}</span>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        {variant.brand && (
          <Badge variant="outline" className="text-xs">
            {variant.brand.name}
          </Badge>
        )}
        {variant.packType && variant.packType !== "loose" && (
          <Badge variant="outline" className="text-xs capitalize">
            {variant.packType}
          </Badge>
        )}
        {Number(variant.weightKg) > 0 && (
          <Badge variant="outline" className="text-xs">
            {variant.weightKg} KG
          </Badge>
        )}
        {variant.color && (
          <Badge variant="outline" className="text-xs capitalize">
            {variant.color}
          </Badge>
        )}
        {variant.size && (
          <Badge variant="outline" className="text-xs">
            Size: {variant.size}
          </Badge>
        )}
        {variant.isPackReturnRequired && (
          <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">
            ♻ Pack Return
          </Badge>
        )}
      </div>

      {variant.sku && (
        <p className="text-xs text-gray-400">
          SKU: <code className="font-mono bg-gray-100 px-1 rounded">{variant.sku}</code>
        </p>
      )}
    </div>
  );
}
