"use client";

import type { Area } from "@bikalpo-project/db/schema";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
    CheckCircle2,
    Edit,
    Globe,
    MapPin,
    PauseCircle,
    Plus,
    Trash2,
    Users,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AreaForm } from "@/components/admin/areas/area-form";
import { AreaSellerAssignment } from "@/components/admin/areas/area-seller-assignment";
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
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { client } from "@/utils/orpc";

type AreaWithStats = {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    parentId: number | null;
    polygon: number[][][] | null;
    centerLat: string | null;
    centerLng: string | null;
    radiusKm: string | null;
    isActive: boolean;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
    sellerCount: number;
};

export function AreaManagement() {
    const queryClient = useQueryClient();
    const [formOpen, setFormOpen] = useState(false);
    const [editingArea, setEditingArea] = useState<AreaWithStats | null>(null);
    const [deleteId, setDeleteId] = useState<number | null>(null);
    const [selectedAreaId, setSelectedAreaId] = useState<number | null>(null);

    // Fetch areas
    const { data: areas = [], isLoading } = useQuery({
        queryKey: ["admin-areas"],
        queryFn: () => client.adminArea.list(),
    });

    const activeCount = areas.filter(
        (a: AreaWithStats) => a.isActive,
    ).length;
    const totalSellers = areas.reduce(
        (sum: number, a: AreaWithStats) => sum + a.sellerCount,
        0,
    );

    const handleEdit = (area: AreaWithStats) => {
        setEditingArea(area);
        setFormOpen(true);
    };

    const handleFormClose = (open: boolean) => {
        setFormOpen(open);
        if (!open) {
            setEditingArea(null);
            queryClient.invalidateQueries({ queryKey: ["admin-areas"] });
        }
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        try {
            await client.adminArea.delete({ id: deleteId });
            toast.success("Area deleted");
            queryClient.invalidateQueries({ queryKey: ["admin-areas"] });
        } catch (error: unknown) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Failed to delete area",
            );
        }
        setDeleteId(null);
    };

    const handleToggle = async (id: number, currentActive: boolean) => {
        try {
            const result = await client.adminArea.toggleActive({
                id,
                isActive: !currentActive,
            });
            toast.success(result.message);
            queryClient.invalidateQueries({ queryKey: ["admin-areas"] });
        } catch (error: unknown) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Failed to update area status",
            );
        }
    };

    const getAreaType = (area: AreaWithStats) => {
        if (area.polygon) return "Polygon";
        if (area.radiusKm) return `Radius (${area.radiusKm}km)`;
        return "Named Zone";
    };

    return (
        <div className="flex flex-col gap-4 sm:gap-6 p-4 sm:p-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <MapPin className="h-6 w-6 text-primary" />
                        Area Management
                    </h1>
                    <p className="text-muted-foreground">
                        Define service areas, zones, and seller territories.
                    </p>
                </div>
                <Button onClick={() => setFormOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    New Area
                </Button>
            </div>

            {/* Stats */}
            <div className="grid gap-3 sm:gap-4 grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Total Areas
                        </CardTitle>
                        <Globe className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {isLoading ? (
                                <span className="animate-pulse">...</span>
                            ) : (
                                areas.length
                            )}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Active
                        </CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-600">
                            {isLoading ? (
                                <span className="animate-pulse">...</span>
                            ) : (
                                activeCount
                            )}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Assigned Sellers
                        </CardTitle>
                        <Users className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">
                            {isLoading ? (
                                <span className="animate-pulse">...</span>
                            ) : (
                                totalSellers
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
                {isLoading ? (
                    [...Array(3)].map((_, i) => (
                        <Card key={i}>
                            <CardContent className="p-4">
                                <div className="animate-pulse space-y-3">
                                    <div className="h-4 bg-muted rounded w-3/4" />
                                    <div className="h-3 bg-muted rounded w-1/2" />
                                    <div className="flex gap-2">
                                        <div className="h-5 bg-muted rounded w-16" />
                                        <div className="h-5 bg-muted rounded w-16" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                ) : areas.length === 0 ? (
                    <Card>
                        <CardContent className="p-8 text-center">
                            <MapPin className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                            <p className="text-muted-foreground">
                                No areas defined yet.
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    areas.map((area: AreaWithStats) => (
                        <Card key={area.id}>
                            <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-medium truncate">
                                            {area.name}
                                        </h3>
                                        {area.description && (
                                            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                                                {area.description}
                                            </p>
                                        )}
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Badge variant="outline" className="text-xs">
                                                {getAreaType(area)}
                                            </Badge>
                                            <Badge
                                                className={
                                                    area.isActive
                                                        ? "bg-emerald-100 text-emerald-700 border-0 text-xs"
                                                        : "bg-gray-100 text-gray-600 border-0 text-xs"
                                                }
                                            >
                                                {area.isActive
                                                    ? "Active"
                                                    : "Inactive"}
                                            </Badge>
                                            <span className="text-xs text-muted-foreground">
                                                {area.sellerCount} sellers
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => handleEdit(area)}
                                        >
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant={selectedAreaId === area.id ? "secondary" : "ghost"}
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() =>
                                                setSelectedAreaId(
                                                    selectedAreaId === area.id ? null : area.id,
                                                )
                                            }
                                            title="Manage Sellers"
                                        >
                                            <Users className="h-4 w-4 text-blue-500" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() =>
                                                handleToggle(
                                                    area.id,
                                                    area.isActive,
                                                )
                                            }
                                        >
                                            {area.isActive ? (
                                                <PauseCircle className="h-4 w-4 text-gray-500" />
                                            ) : (
                                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                            )}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-red-500 hover:text-red-600"
                                            onClick={() =>
                                                setDeleteId(area.id)
                                            }
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block rounded-lg border shadow-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                            <TableHead className="font-semibold">
                                Name
                            </TableHead>
                            <TableHead className="font-semibold">
                                Slug
                            </TableHead>
                            <TableHead className="font-semibold">
                                Type
                            </TableHead>
                            <TableHead className="font-semibold">
                                Sellers
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
                            [...Array(5)].map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell colSpan={6}>
                                        <div className="h-6 bg-muted animate-pulse rounded" />
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : areas.length === 0 ? (
                            <TableRow>
                                <TableCell
                                    colSpan={6}
                                    className="h-24 text-center"
                                >
                                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                        <MapPin className="h-8 w-8" />
                                        <span>
                                            No areas yet. Create one to get
                                            started.
                                        </span>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            areas.map((area: AreaWithStats) => (
                                <TableRow
                                    key={area.id}
                                    className="hover:bg-muted/50 transition-colors"
                                >
                                    <TableCell>
                                        <div>
                                            <span className="font-medium">
                                                {area.name}
                                            </span>
                                            {area.description && (
                                                <p className="text-xs text-muted-foreground line-clamp-1">
                                                    {area.description}
                                                </p>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground font-mono text-sm">
                                        {area.slug}
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            variant="outline"
                                            className="text-xs"
                                        >
                                            {getAreaType(area)}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <span className="flex items-center gap-1">
                                            <Users className="h-3.5 w-3.5 text-muted-foreground" />
                                            {area.sellerCount}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            className={
                                                area.isActive
                                                    ? "bg-emerald-100 text-emerald-700 border-0"
                                                    : "bg-gray-100 text-gray-600 border-0"
                                            }
                                        >
                                            {area.isActive
                                                ? "Active"
                                                : "Inactive"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8"
                                                onClick={() =>
                                                    handleEdit(area)
                                                }
                                            >
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant={selectedAreaId === area.id ? "secondary" : "ghost"}
                                                size="icon"
                                                className="h-8 w-8"
                                                onClick={() =>
                                                    setSelectedAreaId(
                                                        selectedAreaId === area.id ? null : area.id,
                                                    )
                                                }
                                                title="Manage Sellers"
                                            >
                                                <Users className="h-4 w-4 text-blue-500" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8"
                                                onClick={() =>
                                                    handleToggle(
                                                        area.id,
                                                        area.isActive,
                                                    )
                                                }
                                            >
                                                {area.isActive ? (
                                                    <PauseCircle className="h-4 w-4 text-gray-500" />
                                                ) : (
                                                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                                )}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-red-500 hover:text-red-600"
                                                onClick={() =>
                                                    setDeleteId(area.id)
                                                }
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Seller Assignment Panel */}
            {selectedAreaId && (
                <AreaSellerAssignment
                    areaId={selectedAreaId}
                    areaName={areas.find((a: AreaWithStats) => a.id === selectedAreaId)?.name || ""}
                />
            )}

            {/* Form Dialog */}
            <AreaForm
                key={editingArea?.id ?? "new"}
                area={editingArea}
                open={formOpen}
                onOpenChange={handleFormClose}
            />

            {/* Delete Confirmation */}
            <AlertDialog
                open={!!deleteId}
                onOpenChange={() => setDeleteId(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Area</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this area? This will
                            also remove all seller mappings for this area. This
                            action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
