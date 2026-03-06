import { Suspense } from "react";
import { ArrowLeft, ScrollText } from "lucide-react";
import Link from "next/link";
import { StockLedgerClient } from "@/components/features/stock/stock-ledger-client";
import { Button } from "@/components/ui/button";

export const metadata = {
    title: "Stock Ledger",
    description: "Immutable audit trail of all stock movements",
};

export default function StockLedgerPage() {
    return (
        <div className="flex flex-col gap-6 p-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" asChild className="shrink-0">
                        <Link href="/dashboard/admin/stock">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <div>
                        <div className="flex items-center gap-2">
                            <ScrollText className="h-5 w-5 text-gray-500" />
                            <h1 className="text-2xl font-bold tracking-tight">
                                Stock Ledger
                            </h1>
                        </div>
                        <p className="text-muted-foreground ml-7">
                            Immutable audit trail of all stock movements. Entries cannot be
                            edited or deleted.
                        </p>
                    </div>
                </div>
            </div>

            <Suspense
                fallback={
                    <div className="h-64 bg-gray-50 rounded-lg animate-pulse" />
                }
            >
                <StockLedgerClient />
            </Suspense>
        </div>
    );
}
