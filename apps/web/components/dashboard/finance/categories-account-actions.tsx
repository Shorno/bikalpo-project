"use client";

import { ChevronDownIcon } from "lucide-react";
import Link from "next/link";
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
  onEdit: (account: ChartAccount) => void;
};

export function CategoriesAccountActions({
  account,
  onEdit,
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
        <DropdownMenuItem asChild>
          <Link href={`/dashboard/finance/ledger?accountId=${account.id}`}>
            View history
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onEdit(account)}>
          Edit account
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-muted-foreground">
          {account.accountType} account
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
