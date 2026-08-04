"use client";

import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const TYPE_SELLER_ROLES = [
  ["retailer", "Retailer"],
  ["wholesaler", "Wholesaler"],
  ["distributor", "Distributor"],
  ["manufacturer", "Manufacturer"],
  ["importer", "Importer"],
] as const;

export type TypeSellerRole = (typeof TYPE_SELLER_ROLES)[number][0];

export function normalizeTypeSellerRole(value: string): TypeSellerRole {
  return TYPE_SELLER_ROLES.some(([role]) => role === value)
    ? (value as TypeSellerRole)
    : "retailer";
}

export function TypeSellerTabs({
  value,
  onValueChange,
  children,
}: {
  value: TypeSellerRole;
  onValueChange: (value: TypeSellerRole) => void;
  children: (role: TypeSellerRole, label: string) => ReactNode;
}) {
  return (
    <Tabs
      className="gap-0"
      onValueChange={(nextValue) =>
        onValueChange(normalizeTypeSellerRole(nextValue))
      }
      value={value}
    >
      <div className="overflow-x-auto border-b px-4 pt-1">
        <TabsList
          className="h-11 w-max min-w-full justify-start gap-0 p-0"
          variant="line"
        >
          {TYPE_SELLER_ROLES.map(([role, label]) => (
            <TabsTrigger
              className="min-h-11 min-w-32 flex-1 rounded-none px-4 data-active:text-primary after:bg-primary"
              key={role}
              value={role}
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {TYPE_SELLER_ROLES.map(([role, label]) => (
        <TabsContent className="mt-0" key={role} value={role}>
          {children(role, label)}
        </TabsContent>
      ))}
    </Tabs>
  );
}
