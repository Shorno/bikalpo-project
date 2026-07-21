"use client";

import { useEffect, useState } from "react";
import type {
  ChartAccount,
  FinanceCategory,
} from "@/components/dashboard/finance/chart-of-accounts-data";
import {
  loadChartAccountState,
  saveChartAccountState,
} from "@/components/dashboard/finance/chart-of-accounts-storage";

export function CategoriesManager() {
  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [accounts, setAccounts] = useState<ChartAccount[]>([]);

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
        </section>
      </div>
    </main>
  );
}
