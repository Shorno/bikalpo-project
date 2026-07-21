"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  AccountType,
  ChartAccount,
  FinanceCategory,
} from "@/components/dashboard/finance/chart-of-accounts-data";
import { AddAccountDialog } from "@/components/dashboard/finance/add-account-dialog";
import {
  type AccountTypeFilter,
  CategoriesFilters,
} from "@/components/dashboard/finance/categories-filters";
import { CategoriesTable } from "@/components/dashboard/finance/categories-table";
import { CategoriesToolbar } from "@/components/dashboard/finance/categories-toolbar";
import {
  createChartAccountId,
  loadChartAccountState,
  saveChartAccountState,
} from "@/components/dashboard/finance/chart-of-accounts-storage";
import { NewCategoryDialog } from "@/components/dashboard/finance/new-category-dialog";

export function CategoriesManager() {
  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [accounts, setAccounts] = useState<ChartAccount[]>([]);
  const [addAccountOpen, setAddAccountOpen] = useState(false);
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [accountTypeFilter, setAccountTypeFilter] =
    useState<AccountTypeFilter>("ALL");

  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  );

  const filteredAccounts = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return accounts.filter((account) => {
      const category = categoryById.get(account.categoryId);
      const matchesType =
        accountTypeFilter === "ALL" || account.accountType === accountTypeFilter;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        account.name.toLowerCase().includes(normalizedSearch) ||
        account.id.toLowerCase().includes(normalizedSearch) ||
        category?.name.toLowerCase().includes(normalizedSearch);

      return matchesType && matchesSearch;
    });
  }, [accountTypeFilter, accounts, categoryById, searchTerm]);

  const handleCreateCategory = (category: {
    accountType: AccountType;
    name: string;
  }) => {
    const exists = categories.some(
      (item) =>
        item.accountType === category.accountType &&
        item.name.toLowerCase() === category.name.toLowerCase()
    );

    if (!exists) {
      setCategories((currentCategories) => [
        ...currentCategories,
        {
          id: createChartAccountId("category"),
          accountType: category.accountType,
          name: category.name,
          isDefault: false,
        },
      ]);
    }

    setAccountTypeFilter(category.accountType);
    setSearchTerm(category.name);
  };

  useEffect(() => {
    const state = loadChartAccountState();
    setCategories(state.categories);
    setAccounts(state.accounts);
  }, []);

  useEffect(() => {
    if (categories.length === 0 && accounts.length === 0) {
      return;
    }

    saveChartAccountState({ categories, accounts });
  }, [accounts, categories]);

  return (
    <main className="min-h-screen bg-background px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h1 className="font-semibold text-2xl text-foreground">
            Categories
          </h1>
          <p className="text-muted-foreground text-sm">
            Manage your categories
          </p>
        </header>

        <section className="flex flex-col gap-4">
          <div className="border-border border-b pb-2">
            <h2 className="font-medium text-foreground text-sm uppercase tracking-normal">
              Chart of Accounts
            </h2>
          </div>

          <CategoriesToolbar
            accountCount={accounts.length}
            onAddAccount={() => setAddAccountOpen(true)}
            onAddCategory={() => setAddCategoryOpen(true)}
          />

          <CategoriesFilters
            accountType={accountTypeFilter}
            filteredCount={filteredAccounts.length}
            searchTerm={searchTerm}
            onAccountTypeChange={setAccountTypeFilter}
            onSearchTermChange={setSearchTerm}
          />

          <CategoriesTable
            accounts={filteredAccounts}
            categories={categories}
          />
        </section>

        <NewCategoryDialog
          open={addCategoryOpen}
          onCreate={handleCreateCategory}
          onOpenChange={setAddCategoryOpen}
        />
        <AddAccountDialog
          categories={categories}
          open={addAccountOpen}
          onOpenChange={setAddAccountOpen}
        />
      </div>
    </main>
  );
}
