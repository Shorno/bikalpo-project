"use client";

import { useId } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

export function IncludedExcludedButtons({
  label,
  included,
  onChange,
  className,
}: {
  label: string;
  included: boolean;
  onChange?: (included: boolean) => void;
  className?: string;
}) {
  const id = useId();

  return (
    <RadioGroup
      value={included ? "yes" : "no"}
      onValueChange={(value) => onChange?.(value === "yes")}
      disabled={!onChange}
      className={cn(
        "inline-flex w-auto min-w-32 items-center gap-4",
        className,
      )}
      aria-label={`${label}: Yes or No`}
    >
      <label
        htmlFor={`${id}-yes`}
        className={cn(
          "flex min-h-9 cursor-pointer items-center gap-2 text-sm text-gray-700",
          !onChange && "cursor-default",
        )}
      >
        <RadioGroupItem
          id={`${id}-yes`}
          value="yes"
          className="disabled:opacity-100"
        />
        Yes
      </label>
      <label
        htmlFor={`${id}-no`}
        className={cn(
          "flex min-h-9 cursor-pointer items-center gap-2 text-sm text-gray-700",
          !onChange && "cursor-default",
        )}
      >
        <RadioGroupItem
          id={`${id}-no`}
          value="no"
          className="disabled:opacity-100"
        />
        No
      </label>
    </RadioGroup>
  );
}
