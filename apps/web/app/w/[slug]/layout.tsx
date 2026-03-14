import type { ReactNode } from "react";
import Link from "next/link";
import { WarehouseIcon } from "lucide-react";

export default function WarehouseStorefrontLayout({
    children,
}: {
    children: ReactNode;
}) {
    return (
        <div className="min-h-screen flex flex-col bg-[#fafaf8]">
            {/* Minimal warehouse navbar */}
            <header className="bg-white border-b shadow-sm sticky top-0 z-40">
                <div className="container mx-auto px-4 h-14 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2">
                        <WarehouseIcon className="w-5 h-5 text-amber-600" />
                        <span className="font-bold text-lg">Bikalpo Warehouse</span>
                    </Link>
                    <div className="flex items-center gap-3 text-sm text-gray-500">
                        <span className="hidden sm:inline">Private Supplier Storefront</span>
                    </div>
                </div>
            </header>
            <main className="flex-1">{children}</main>
            {/* Minimal footer */}
            <footer className="bg-white border-t py-4">
                <div className="container mx-auto px-4 text-center text-sm text-gray-400">
                    Bikalpo Warehouse — Private Supplier Platform
                </div>
            </footer>
        </div>
    );
}
