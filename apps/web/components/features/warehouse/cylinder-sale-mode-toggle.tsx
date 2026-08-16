"use client";

import {
  type CylinderSaleMode,
  CylinderTypeRadios,
} from "@/components/features/products/cylinder-type-radios";

export function CylinderSaleModeToggle({
  value,
  onChange,
}: {
  value: CylinderSaleMode;
  onChange: (mode: CylinderSaleMode) => void;
}) {
  return (
    <CylinderTypeRadios
      hint
      onChange={onChange}
      size="modal"
      value={value}
    />
  );
}
