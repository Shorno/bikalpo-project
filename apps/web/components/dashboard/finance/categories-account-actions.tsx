"use client";

import { ChevronDownIcon } from "lucide-react";
import type { ChartAccount } from "@/components/dashboard/finance/chart-of-accounts-data";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type CategoriesAccountActionsProps = {
  account: ChartAccount;
};

export function CategoriesAccountActions({
  account,
}: CategoriesAccountActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="ml-auto">
          Account History
          <ChevronDownIcon data-icon="inline-end" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem>View history</DropdownMenuItem>
        <DropdownMenuItem>Edit account</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-muted-foreground">
          {account.accountType} account
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
