import {
  BarChart3Icon,
  FileTextIcon,
  LandmarkIcon,
  TagsIcon,
} from "lucide-react";
import Link from "next/link";

const financeLinks = [
  {
    title: "Profit & Loss",
    description: "Income, expense, gross profit, and net profit statement.",
    href: "/dashboard/finance/profit-loss",
    icon: BarChart3Icon,
  },
  {
    title: "Balance Sheet",
    description: "Assets, liabilities, and equity position.",
    href: "/dashboard/finance/balance-sheet",
    icon: FileTextIcon,
  },
  {
    title: "Categories",
    description: "Chart of accounts categories and account setup.",
    href: "/dashboard/finance/categories",
    icon: TagsIcon,
  },
  {
    title: "Ledger",
    description: "Account movement and trial balance tools.",
    href: "/dashboard/finance/ledger",
    icon: LandmarkIcon,
  },
];

export default function ShopFinanceOverviewPage() {
  return (
    <main className="space-y-6">
      <div>
        <h1 className="font-semibold text-2xl text-slate-950">
          Finance & Accounts
        </h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Financial overview, statements, ledgers, and chart account setup.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {financeLinks.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg border bg-white p-4 shadow-sm transition hover:border-blue-200 hover:shadow-md"
            >
              <div className="flex size-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                <Icon className="size-5" />
              </div>
              <h2 className="mt-4 font-semibold text-slate-950">
                {item.title}
              </h2>
              <p className="mt-1 text-muted-foreground text-sm">
                {item.description}
              </p>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
