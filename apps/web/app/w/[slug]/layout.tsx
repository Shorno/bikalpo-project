import { WarehouseIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export default function WarehouseStorefrontLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-zinc-50">
      {/* Storefront navbar */}
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/85 backdrop-blur-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-900 text-white">
              <WarehouseIcon className="w-[18px] h-[18px]" />
            </span>
            <span className="font-semibold text-[15px] tracking-tight text-zinc-900">
              Bikalpo Warehouse
            </span>
          </Link>
          <span className="hidden sm:inline text-xs font-medium text-zinc-500">
            Private Supplier Storefront
          </span>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 bg-white">
        <div className="container mx-auto px-4 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-zinc-500">
          <span>Bikalpo Warehouse — Private Supplier Platform</span>
          <span className="text-zinc-400">Restricted B2B access</span>
        </div>
      </footer>
    </div>
  );
}
