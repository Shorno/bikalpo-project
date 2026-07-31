"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AddAccountDialog } from "@/components/dashboard/finance/add-account-dialog";
import {
  type AccountTypeFilter,
  CategoriesFilters,
} from "@/components/dashboard/finance/categories-filters";
import { CategoriesTable } from "@/components/dashboard/finance/categories-table";
import { CategoriesToolbar } from "@/components/dashboard/finance/categories-toolbar";
import {
  type AccountType,
  type ChartAccount,
  DEFAULT_CHART_ACCOUNTS,
  DEFAULT_FINANCE_CATEGORIES,
  type FinanceCategory,
} from "@/components/dashboard/finance/chart-of-accounts-data";
import { NewCategoryDialog } from "@/components/dashboard/finance/new-category-dialog";
import { orpc } from "@/utils/orpc";

function isCashAndBankCategory(category: FinanceCategory | undefined) {
  return (
    category?.accountType === "ASSET" &&
    category.name.trim().toLowerCase() === "cash and bank"
  );
}

function upsertById<TItem extends { id: string }>(
  items: TItem[],
  nextItem: TItem,
) {
  const existingIndex = items.findIndex((item) => item.id === nextItem.id);

  if (existingIndex === -1) {
    return [nextItem, ...items];
  }

  return items.map((item, index) =>
    index === existingIndex ? nextItem : item,
  );
}

export function CategoriesManager() {
  const queryClient = useQueryClient();
  const [categories, setCategories] = useState<FinanceCategory[]>(
    DEFAULT_FINANCE_CATEGORIES,
  );
  const [accounts, setAccounts] = useState<ChartAccount[]>(
    DEFAULT_CHART_ACCOUNTS,
  );
  const [addAccountOpen, setAddAccountOpen] = useState(false);
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [accountTypeFilter, setAccountTypeFilter] =
    useState<AccountTypeFilter>("ALL");

  const { data } = useQuery(
    orpc.finance.getChartOfAccounts.queryOptions({ input: {} }),
  );

  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );

  const createCategoryMutation = useMutation(
    orpc.finance.createCategory.mutationOptions({
      onSuccess: (result) => {
        toast.success(result.message);
        setCategories((currentCategories) =>
          upsertById(currentCategories, result.category),
        );
        void queryClient.invalidateQueries({
          queryKey: orpc.finance.getChartOfAccounts.key(),
        });
        setAccountTypeFilter(result.category.accountType);
        setSearchTerm(result.category.name);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to create category");
      },
    }),
  );

  const createAccountMutation = useMutation(
    orpc.finance.createAccount.mutationOptions({
      onSuccess: (result) => {
        toast.success(result.message);
        setAccounts((currentAccounts) =>
          upsertById(currentAccounts, result.account),
        );
        void queryClient.invalidateQueries({
          queryKey: orpc.finance.getChartOfAccounts.key(),
        });
        if (
          isCashAndBankCategory(categoryById.get(result.account.categoryId))
        ) {
          void queryClient.invalidateQueries({
            queryKey: orpc.finance.getPaymentAccounts.key(),
          });
        }
        setAccountTypeFilter(result.account.accountType);
        setSearchTerm(result.account.name);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to create account");
      },
    }),
  );

  const filteredAccounts = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return accounts.filter((account) => {
      const category = categoryById.get(account.categoryId);
      const matchesType =
        accountTypeFilter === "ALL" ||
        account.accountType === accountTypeFilter;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        account.name.toLowerCase().includes(normalizedSearch) ||
        account.id.toLowerCase().includes(normalizedSearch) ||
        category?.name.toLowerCase().includes(normalizedSearch);

      return matchesType && matchesSearch;
    });
  }, [accountTypeFilter, accounts, categoryById, searchTerm]);

  useEffect(() => {
    if (!data) {
      return;
    }

    setCategories(data.categories);
    setAccounts(data.accounts);
  }, [data]);

  const handleCreateCategory = (category: {
    accountType: AccountType;
    name: string;
  }) => {
    createCategoryMutation.mutate(category);
  };

  const handleCreateAccount = (account: Omit<ChartAccount, "id">) => {
    createAccountMutation.mutate({
      accountType: account.accountType,
      amount: account.amount,
      categoryId: account.categoryId,
      description: account.description,
      isSubaccount: account.isSubaccount,
      name: account.name,
      parentAccountId: account.parentAccountId || null,
    });
  };

  return (
    <main className="min-h-screen bg-background px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-foreground">Categories</h1>
          <p className="text-sm text-muted-foreground">
            Manage your categories
          </p>
        </header>

        <section className="flex flex-col gap-4">
          <div className="border-b border-border pb-2">
            <h2 className="text-sm font-medium uppercase tracking-normal text-foreground">
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
          onCreate={handleCreateAccount}
          onOpenChange={setAddAccountOpen}
        />
      </div>
    </main>
  );
}
