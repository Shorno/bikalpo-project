"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
    Plus,
    Trash2,
    UserPlus,
    Users,
    Store,
    X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { client } from "@/utils/orpc";

interface AreaSellerAssignmentProps {
    areaId: number;
    areaName: string;
}

type SellerInfo = {
    mappingId: number;
    sellerId: string;
    sellerName: string;
    sellerEmail: string;
    shopName: string | null;
    shopLat: string | null;
    shopLng: string | null;
    overrideRadiusKm: string | null;
    isActive: boolean;
    createdAt: Date;
};

type AvailableSeller = {
    id: string;
    name: string;
    email: string;
    shopName: string | null;
    shopAddress: string | null;
};

export function AreaSellerAssignment({
    areaId,
    areaName,
}: AreaSellerAssignmentProps) {
    const queryClient = useQueryClient();
    const [assignDialogOpen, setAssignDialogOpen] = useState(false);
    const [removeId, setRemoveId] = useState<number | null>(null);
    const [selectedSellers, setSelectedSellers] = useState<string[]>([]);
    const [assigning, setAssigning] = useState(false);

    // Fetch current sellers in this area
    const { data: sellers = [], isLoading } = useQuery({
        queryKey: ["area-sellers", areaId],
        queryFn: () => client.adminSellerArea.getAreaSellers({ areaId }),
    });

    // Fetch available sellers for assignment dialog
    const { data: availableSellers = [], isLoading: loadingAvailable } =
        useQuery({
            queryKey: ["available-sellers", areaId],
            queryFn: () =>
                client.adminSellerArea.getAvailableSellers({ areaId }),
            enabled: assignDialogOpen,
        });

    const handleRemove = async () => {
        if (!removeId) return;
        try {
            await client.adminSellerArea.remove({ mappingId: removeId });
            toast.success("Seller removed from area");
            queryClient.invalidateQueries({
                queryKey: ["area-sellers", areaId],
            });
            queryClient.invalidateQueries({ queryKey: ["admin-areas"] });
        } catch (error: unknown) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Failed to remove seller",
            );
        }
        setRemoveId(null);
    };

    const handleBulkAssign = async () => {
        if (selectedSellers.length === 0) return;
        setAssigning(true);
        try {
            const result = await client.adminSellerArea.bulkAssign({
                sellerIds: selectedSellers,
                areaId,
            });
            toast.success(result.message);
            setSelectedSellers([]);
            setAssignDialogOpen(false);
            queryClient.invalidateQueries({
                queryKey: ["area-sellers", areaId],
            });
            queryClient.invalidateQueries({
                queryKey: ["available-sellers", areaId],
            });
            queryClient.invalidateQueries({ queryKey: ["admin-areas"] });
        } catch (error: unknown) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Failed to assign sellers",
            );
        } finally {
            setAssigning(false);
        }
    };

    const toggleSeller = (sellerId: string) => {
        setSelectedSellers((prev) =>
            prev.includes(sellerId)
                ? prev.filter((id) => id !== sellerId)
                : [...prev, sellerId],
        );
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    <h3 className="text-lg font-semibold">
                        Sellers in {areaName}
                    </h3>
                    <Badge variant="outline">{sellers.length}</Badge>
                </div>
                <Button
                    size="sm"
                    onClick={() => setAssignDialogOpen(true)}
                >
                    <UserPlus className="mr-2 h-4 w-4" />
                    Assign Sellers
                </Button>
            </div>

            {/* Sellers Table */}
            <div className="rounded-lg border shadow-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                            <TableHead className="font-semibold">
                                Seller
                            </TableHead>
                            <TableHead className="font-semibold">
                                Shop
                            </TableHead>
                            <TableHead className="font-semibold">
                                Status
                            </TableHead>
                            <TableHead className="font-semibold text-right">
                                Actions
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            [...Array(3)].map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell colSpan={4}>
                                        <div className="h-6 bg-muted animate-pulse rounded" />
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : sellers.length === 0 ? (
                            <TableRow>
                                <TableCell
                                    colSpan={4}
                                    className="h-20 text-center"
                                >
                                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                        <Users className="h-6 w-6" />
                                        <span>
                                            No sellers assigned. Click
                                            &quot;Assign Sellers&quot; to add.
                                        </span>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            sellers.map((seller: SellerInfo) => (
                                <TableRow
                                    key={seller.mappingId}
                                    className="hover:bg-muted/50"
                                >
                                    <TableCell>
                                        <div>
                                            <span className="font-medium">
                                                {seller.sellerName}
                                            </span>
                                            <p className="text-xs text-muted-foreground">
                                                {seller.sellerEmail}
                                            </p>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <span className="flex items-center gap-1">
                                            <Store className="h-3.5 w-3.5 text-muted-foreground" />
                                            {seller.shopName || "—"}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            className={
                                                seller.isActive
                                                    ? "bg-emerald-100 text-emerald-700 border-0"
                                                    : "bg-gray-100 text-gray-600 border-0"
                                            }
                                        >
                                            {seller.isActive
                                                ? "Active"
                                                : "Removed"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-red-500 hover:text-red-600"
                                            onClick={() =>
                                                setRemoveId(
                                                    seller.mappingId,
                                                )
                                            }
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Assign Dialog */}
            <Dialog
                open={assignDialogOpen}
                onOpenChange={(open) => {
                    setAssignDialogOpen(open);
                    if (!open) setSelectedSellers([]);
                }}
            >
                <DialogContent className="sm:max-w-[500px] max-h-[80vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>
                            Assign Sellers to {areaName}
                        </DialogTitle>
                        <DialogDescription>
                            Select sellers to assign to this area. They will
                            be able to receive orders from this zone.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedSellers.length > 0 && (
                        <div className="flex items-center gap-2 text-sm text-primary">
                            <Badge>{selectedSellers.length} selected</Badge>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedSellers([])}
                            >
                                <X className="h-3 w-3 mr-1" />
                                Clear
                            </Button>
                        </div>
                    )}

                    <div className="flex-1 overflow-y-auto border rounded-lg">
                        {loadingAvailable ? (
                            <div className="p-4 space-y-3">
                                {[...Array(3)].map((_, i) => (
                                    <div
                                        key={i}
                                        className="h-12 bg-muted animate-pulse rounded"
                                    />
                                ))}
                            </div>
                        ) : availableSellers.length === 0 ? (
                            <div className="p-8 text-center text-muted-foreground">
                                <Users className="h-8 w-8 mx-auto mb-2" />
                                <p>
                                    All sellers are already assigned to this
                                    area.
                                </p>
                            </div>
                        ) : (
                            <div className="divide-y">
                                {availableSellers.map(
                                    (seller: AvailableSeller) => (
                                        <label
                                            key={seller.id}
                                            className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer"
                                        >
                                            <Checkbox
                                                checked={selectedSellers.includes(
                                                    seller.id,
                                                )}
                                                onCheckedChange={() =>
                                                    toggleSeller(seller.id)
                                                }
                                            />
                                            <div className="flex-1 min-w-0">
                                                <span className="font-medium text-sm">
                                                    {seller.name}
                                                </span>
                                                <p className="text-xs text-muted-foreground truncate">
                                                    {seller.shopName ||
                                                        seller.email}
                                                    {seller.shopAddress &&
                                                        ` · ${seller.shopAddress}`}
                                                </p>
                                            </div>
                                        </label>
                                    ),
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <Button
                            variant="outline"
                            onClick={() => setAssignDialogOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleBulkAssign}
                            disabled={
                                selectedSellers.length === 0 || assigning
                            }
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            Assign {selectedSellers.length > 0 &&
                                `(${selectedSellers.length})`}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Remove Confirmation */}
            <AlertDialog
                open={!!removeId}
                onOpenChange={() => setRemoveId(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Remove Seller from Area
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            This seller will no longer be able to receive
                            orders from this area. You can re-assign them
                            later.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleRemove}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            Remove
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
