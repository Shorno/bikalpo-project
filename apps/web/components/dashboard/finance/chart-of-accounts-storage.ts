import {
  DEFAULT_CHART_ACCOUNTS,
  DEFAULT_FINANCE_CATEGORIES,
  type ChartAccount,
  type FinanceCategory,
} from "@/components/dashboard/finance/chart-of-accounts-data";

const STORAGE_KEY = "bikalpo.finance.chart-of-accounts.v1";

export type ChartAccountState = {
  categories: FinanceCategory[];
  accounts: ChartAccount[];
};

const defaultState: ChartAccountState = {
  categories: DEFAULT_FINANCE_CATEGORIES,
  accounts: DEFAULT_CHART_ACCOUNTS,
};

const isBrowser = () => typeof window !== "undefined";

const mergeDefaultCategories = (categories: FinanceCategory[]) => {
  const categoryIds = new Set(categories.map((category) => category.id));
  const missingDefaults = DEFAULT_FINANCE_CATEGORIES.filter(
    (category) => !categoryIds.has(category.id)
  );

  return [...missingDefaults, ...categories];
};

export const loadChartAccountState = (): ChartAccountState => {
  if (!isBrowser()) {
    return defaultState;
  }

  const rawState = window.localStorage.getItem(STORAGE_KEY);

  if (!rawState) {
    return defaultState;
  }

  try {
    const parsed = JSON.parse(rawState) as Partial<ChartAccountState>;
    return {
      categories: mergeDefaultCategories(parsed.categories ?? []),
      accounts: parsed.accounts ?? DEFAULT_CHART_ACCOUNTS,
    };
  } catch {
    return defaultState;
  }
};

export const saveChartAccountState = (state: ChartAccountState) => {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

export const createChartAccountId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
