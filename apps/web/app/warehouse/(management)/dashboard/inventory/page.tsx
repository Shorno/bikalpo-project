"use client";

import {
    BoxesIcon,
    Plus,
    Warehouse,
    MapPin,
    Loader2,
    ExternalLink,
    AlertCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { orpc } from "@/utils/orpc";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function WarehouseInventoryPage() {
    const [modalOpen, setModalOpen] = useState(false);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
                    <p className="text-sm text-muted-foreground">Manage your warehouse stock</p>
                </div>
                <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-amber-600 hover:bg-amber-700">
                            <Plus className="w-4 h-4 mr-2" />
                            Add Product
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Add Product from Another Warehouse</DialogTitle>
                            <DialogDescription>
                                Paste a warehouse storefront URL to browse and order products.
                            </DialogDescription>
                        </DialogHeader>
                        <WarehouseUrlModal onClose={() => setModalOpen(false)} />
                    </DialogContent>
                </Dialog>
            </div>
            <div className="flex flex-col items-center justify-center py-24 text-center border rounded-lg bg-muted/30">
                <BoxesIcon className="size-12 text-muted-foreground mb-3" />
                <p className="text-muted-foreground text-lg font-medium">No inventory items yet</p>
                <p className="text-sm text-muted-foreground mt-1">Your inventory will appear here once products are added.</p>
                <Button
                    className="mt-4 bg-amber-600 hover:bg-amber-700"
                    onClick={() => setModalOpen(true)}
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Product from Warehouse
                </Button>
            </div>
        </div>
    );
}

// ────────────────────────────────────────────────────────────────
// Warehouse URL Modal (same as shop owner version)
// ────────────────────────────────────────────────────────────────

function WarehouseUrlModal({ onClose }: { onClose: () => void }) {
    const router = useRouter();
    const [url, setUrl] = useState("");
    const [parsedSlug, setParsedSlug] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    function parseSlug(input: string): string | null {
        const trimmed = input.trim();
        if (!trimmed) return null;
        if (!trimmed.includes("/")) return trimmed;
        const match = trimmed.match(/\/(?:warehouse|w)\/([^/?#]+)/);
        return match ? match[1] : null;
    }

    function handlePreview() {
        setError(null);
        const slug = parseSlug(url);
        if (!slug) {
            setError("Please enter a valid warehouse URL or slug.");
            return;
        }
        setParsedSlug(slug);
    }

    const { data: warehouse, isLoading, error: fetchError } = useQuery(
        orpc.warehouse.getStorefrontBySlug.queryOptions({
            input: { slug: parsedSlug! },
            enabled: !!parsedSlug,
        }),
    );

    const warehouseNotFound = fetchError && parsedSlug;

    return (
        <div className="space-y-4 pt-2">
            <div className="space-y-2">
                <label className="text-sm font-medium">Warehouse URL or Slug</label>
                <div className="flex gap-2">
                    <Input
                        placeholder="e.g. /warehouse/zenstore or zenstore"
                        value={url}
                        onChange={(e) => {
                            setUrl(e.target.value);
                            setParsedSlug(null);
                            setError(null);
                        }}
                        onKeyDown={(e) => e.key === "Enter" && handlePreview()}
                    />
                    <Button onClick={handlePreview} disabled={!url.trim()}>
                        Preview
                    </Button>
                </div>
                {error && <p className="text-sm text-red-500">{error}</p>}
            </div>

            {isLoading && parsedSlug && (
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-amber-600" />
                </div>
            )}

            {warehouseNotFound && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
                    <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                    <p className="text-sm text-red-600 font-medium">Warehouse not found</p>
                    <p className="text-xs text-red-500 mt-1">Check the URL and try again.</p>
                </div>
            )}

            {warehouse && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 space-y-3">
                    <div className="flex items-start gap-3">
                        <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
                            <Warehouse className="w-6 h-6 text-amber-600" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900">
                                {warehouse.warehouseName || warehouse.name}
                            </h3>
                            {warehouse.warehouseAddress && (
                                <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                                    <MapPin className="w-3 h-3" />
                                    {warehouse.warehouseAddress}
                                </p>
                            )}
                            <p className="text-sm text-amber-700 font-medium mt-1">
                                {warehouse.productCount} products available
                            </p>
                        </div>
                    </div>
                    <Button
                        className="w-full bg-amber-600 hover:bg-amber-700"
                        onClick={() => {
                            onClose();
                            const baseUrl = window.location.origin.replace(/^(https?:\/\/)(?:shop\.|warehouse\.)/, "$1");
                            window.location.href = `${baseUrl}/w/${parsedSlug}`;
                        }}
                    >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Visit Warehouse Store
                    </Button>
                </div>
            )}
        </div>
    );
}
