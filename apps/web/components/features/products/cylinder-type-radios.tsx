"use client";

import { useId } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export type CylinderSaleMode = "new" | "exchange";

/**
 * Compact display label for a variant chip: drops words already present in the
 * product name (e.g. "Cylinder") and removes redundant duplicate tokens so
 * "45 KG Cylinder · 45" reads as "45 KG". Display-only — cart keys off variantId.
 */
export function shortVariantLabel(label: string, productName: string): string {
  const nameWords = new Set(
    productName.toLowerCase().split(/\s+/).filter(Boolean),
  );
  const parts = label
    .split("·")
    .map((part) =>
      part
        .trim()
        .split(/\s+/)
        .filter((word) => !nameWords.has(word.toLowerCase()))
        .join(" ")
        .trim(),
    )
    .filter(Boolean);
  const deduped = parts.filter(
    (part, i) =>
      !parts.some(
        (other, j) =>
          j !== i &&
          other.length > part.length &&
          other.toLowerCase().includes(part.toLowerCase()),
      ),
  );
  return deduped.join(" · ").trim() || label;
}

export function CylinderTypeRadios({
  value,
  onChange,
  size = "card",
  appearance = "segmented",
  hint = false,
  quantity = 1,
}: {
  value: CylinderSaleMode;
  onChange: (mode: CylinderSaleMode) => void;
  size?: "card" | "modal";
  appearance?: "segmented" | "radio";
  hint?: boolean;
  quantity?: number;
}) {
  const isModal = size === "modal";
  const returnQuantity = Math.max(1, Math.floor(quantity));
  const labelId = `${useId()}-label`;

  const hintText =
    value === "new"
      ? "No empty cylinder returned"
      : `Return ${returnQuantity} empty cylinder${
          returnQuantity === 1 ? "" : "s"
        }`;

  if (appearance === "radio") {
    return (
      <div>
        <span
          className={
            isModal
              ? "mb-2 block text-xs font-medium text-zinc-500"
              : "mb-1.5 block text-[11px] font-medium text-zinc-400"
          }
          id={labelId}
        >
          Type
        </span>
        <RadioGroup
          aria-labelledby={labelId}
          className="flex w-auto flex-wrap gap-x-4 gap-y-2"
          onValueChange={(mode) => onChange(mode as CylinderSaleMode)}
          value={value}
        >
          {(["exchange", "new"] as const).map((mode) => {
            const optionId = `${labelId}-${mode}`;

            return (
              <label
                className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-zinc-700"
                htmlFor={optionId}
                key={mode}
              >
                <RadioGroupItem id={optionId} value={mode} />
                <span>{mode === "exchange" ? "Exchange" : "New"}</span>
              </label>
            );
          })}
        </RadioGroup>
        {hint ? (
          <p className="mt-1.5 text-[11px] leading-4 text-zinc-500">
            {hintText}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <span
        className={
          isModal
            ? "mb-2 block text-xs font-medium text-zinc-500"
            : "mb-1.5 block text-[11px] font-medium text-zinc-400"
        }
      >
        Type
      </span>
      <div
        aria-label="Cylinder sale type"
        className="inline-grid grid-cols-2 rounded-md border border-zinc-200 bg-zinc-100 p-px"
        role="radiogroup"
      >
        {(["exchange", "new"] as const).map((mode) => {
          const selected = value === mode;
          return (
            <button
              aria-checked={selected}
              className={`rounded-[5px] px-2.5 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/30 ${
                isModal ? "h-7 text-xs" : "h-6 text-[11px]"
              } ${
                selected
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-500 hover:text-zinc-800"
              }`}
              key={mode}
              onClick={() => onChange(mode)}
              role="radio"
              type="button"
            >
              {mode === "exchange" ? "Exchange" : "New"}
            </button>
          );
        })}
      </div>
      {hint ? (
        <p className="mt-1.5 text-[11px] leading-4 text-zinc-500">{hintText}</p>
      ) : null}
    </div>
  );
}

export function CylinderTypePreview({
  exchangeAvailable = true,
  size = "card",
}: {
  exchangeAvailable?: boolean;
  size?: "card" | "modal";
}) {
  const isModal = size === "modal";

  return (
    <div>
      <span
        className={
          isModal
            ? "mb-2 block text-xs font-medium text-zinc-500"
            : "mb-1.5 block text-[11px] font-medium text-zinc-400"
        }
      >
        Type
      </span>
      <div
        aria-label="Available cylinder sale types"
        className={`inline-grid rounded-md border border-zinc-200 bg-zinc-100 p-px ${
          exchangeAvailable ? "grid-cols-2" : "grid-cols-1"
        }`}
        role="list"
      >
        {(
          [
            "new",
            ...(exchangeAvailable ? (["exchange"] as const) : []),
          ] as const
        ).map((mode) => {
          return (
            <span
              className={`inline-flex items-center justify-center rounded-[5px] px-2.5 font-medium ${
                isModal ? "h-7 text-xs" : "h-6 text-[11px]"
              } whitespace-nowrap bg-white text-zinc-700`}
              key={mode}
              role="listitem"
            >
              {mode === "exchange" ? "Exchange" : "New"}
            </span>
          );
        })}
      </div>
    </div>
  );
}
