"use client";

import { ChevronDownIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

type CategoriesToolbarProps = {
  accountCount: number;
  onAddAccount: () => void;
  onAddCategory: () => void;
};

export function CategoriesToolbar({
  accountCount,
  onAddAccount,
  onAddCategory,
}: CategoriesToolbarProps) {
  return (
    <div className="flex flex-col gap-3 border-border border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2 text-foreground text-sm">
        <span className="font-medium">All Lists</span>
        <span className="text-muted-foreground">{accountCount} accounts</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={onAddAccount}>
          <PlusIcon data-icon="inline-start" />
          Add Account
        </Button>
        <Button onClick={onAddCategory}>
          <PlusIcon data-icon="inline-start" />
          New Category
          <ChevronDownIcon data-icon="inline-end" />
        </Button>
      </div>
    </div>
  );
}
