"use client";

import type {
  ChartAccount,
  FinanceCategory,
} from "@/components/dashboard/finance/chart-of-accounts-data";
import { CategoriesAccountActions } from "@/components/dashboard/finance/categories-account-actions";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type CategoriesTableProps = {
  accounts: ChartAccount[];
  categories: FinanceCategory[];
};

export function CategoriesTable({
  accounts,
  categories,
}: CategoriesTableProps) {
  const categoryById = new Map(
    categories.map((category) => [category.id, category])
  );

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-background">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox aria-label="Select all accounts" />
            </TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Account Type</TableHead>
            <TableHead>Category</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {accounts.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={5}
                className="h-28 text-center text-muted-foreground"
              >
                No accounts match the current filters.
              </TableCell>
            </TableRow>
          )}

          {accounts.map((account) => {
            const category = categoryById.get(account.categoryId);

            return (
              <TableRow key={account.id}>
                <TableCell>
                  <Checkbox aria-label={`Select ${account.name}`} />
                </TableCell>
                <TableCell className="font-medium">{account.name}</TableCell>
                <TableCell>{account.accountType}</TableCell>
                <TableCell>{category?.name ?? "Uncategorized"}</TableCell>
                <TableCell className="text-right">
                  <CategoriesAccountActions account={account} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
