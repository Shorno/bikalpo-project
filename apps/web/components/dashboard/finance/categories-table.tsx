"use client";

import type {
  ChartAccount,
  FinanceCategory,
} from "@/components/dashboard/finance/chart-of-accounts-data";
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
    <div className="border-border border-t">
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
                <TableCell className="text-right text-muted-foreground">
                  Account History
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
