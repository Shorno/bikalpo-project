"use client";

import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { client } from "@/utils/orpc";
import type { AddressInfo } from "@/components/admin/areas/area-polygon-editor";

const AreaPolygonEditor = dynamic(
    () => import("@/components/admin/areas/area-polygon-editor"),
    { ssr: false, loading: () => <div className="h-[350px] bg-muted animate-pulse rounded-lg" /> },
);

const formSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    slug: z
        .string()
        .min(2)
        .regex(
            /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
            "Slug must be lowercase with hyphens",
        ),
    description: z.string().optional().default(""),
    parentId: z.number().int().optional().nullable(),
    centerLat: z.string().optional().default(""),
    centerLng: z.string().optional().default(""),
    radiusKm: z.string().optional().default(""),
    isActive: z.boolean().default(true),
    sortOrder: z.number().int().default(0),
});

interface AreaFormProps {
    area?: {
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
    } | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

/**
 * Generate a URL-friendly slug from a name
 */
function generateSlug(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
}

export function AreaForm({ area, open, onOpenChange }: AreaFormProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [polygonCoords, setPolygonCoords] = useState<number[][][] | null>(area?.polygon ?? null);
    const [resolvedAddress, setResolvedAddress] = useState<AddressInfo | null>(null);
    const isEditing = !!area;

    // Fetch parent area options
    const { data: parentAreas = [] } = useQuery({
        queryKey: ["admin-areas-top-level"],
        queryFn: () => client.adminArea.getTopLevel(),
        enabled: open,
    });

    const form = useForm({
        defaultValues: {
            name: area?.name || "",
            slug: area?.slug || "",
            description: area?.description || "",
            parentId: area?.parentId ?? null,
            centerLat: area?.centerLat || "",
            centerLng: area?.centerLng || "",
            radiusKm: area?.radiusKm || "",
            isActive: area?.isActive ?? true,
            sortOrder: area?.sortOrder ?? 0,
        },
        onSubmit: async ({ value }) => {
            setIsSubmitting(true);
            try {
                const payload = {
                    name: value.name,
                    slug: value.slug,
                    description: value.description || undefined,
                    parentId: value.parentId || undefined,
                    polygon: polygonCoords || undefined,
                    centerLat: value.centerLat || undefined,
                    centerLng: value.centerLng || undefined,
                    radiusKm: value.radiusKm || undefined,
                    isActive: value.isActive,
                    sortOrder: value.sortOrder,
                };

                if (isEditing) {
                    await client.adminArea.update({
                        id: area.id,
                        ...payload,
                    });
                } else {
                    await client.adminArea.create(payload);
                }

                toast.success(
                    isEditing ? "Area updated" : "Area created",
                );
                onOpenChange(false);
                form.reset();
            } catch (error: unknown) {
                toast.error(
                    error instanceof Error
                        ? error.message
                        : "Something went wrong",
                );
            } finally {
                setIsSubmitting(false);
            }
        },
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[800px]">
                <DialogHeader className="pb-2">
                    <DialogTitle>
                        {isEditing ? "Edit Area" : "New Area"}
                    </DialogTitle>
                </DialogHeader>

                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        form.handleSubmit();
                    }}
                    className="space-y-3"
                >
                    {/* ── Compact Info Grid ── */}
                    <div className="grid grid-cols-3 gap-2">
                        {/* Name */}
                        <form.Field name="name">
                            {(field) => (
                                <Field>
                                    <FieldLabel htmlFor={field.name} className="text-xs">
                                        Name *
                                    </FieldLabel>
                                    <Input
                                        id={field.name}
                                        value={field.state.value}
                                        onChange={(e) => {
                                            field.handleChange(e.target.value);
                                            if (!isEditing) {
                                                form.setFieldValue(
                                                    "slug",
                                                    generateSlug(e.target.value),
                                                );
                                            }
                                        }}
                                        placeholder="e.g., Dhaka North"
                                        className="h-9"
                                    />
                                    {field.state.meta.isTouched &&
                                        field.state.meta.errors.length > 0 && (
                                            <p className="text-xs text-red-500">
                                                {typeof field.state.meta.errors[0] === "string"
                                                    ? field.state.meta.errors[0]
                                                    : field.state.meta.errors[0]?.message || "Invalid value"}
                                            </p>
                                        )}
                                </Field>
                            )}
                        </form.Field>

                        {/* Slug */}
                        <form.Field name="slug">
                            {(field) => (
                                <Field>
                                    <FieldLabel htmlFor={field.name} className="text-xs">
                                        Slug *
                                    </FieldLabel>
                                    <Input
                                        id={field.name}
                                        value={field.state.value}
                                        onChange={(e) => field.handleChange(e.target.value)}
                                        placeholder="e.g., dhaka-north"
                                        className="font-mono text-sm h-9"
                                    />
                                    {field.state.meta.isTouched &&
                                        field.state.meta.errors.length > 0 && (
                                            <p className="text-xs text-red-500">
                                                {typeof field.state.meta.errors[0] === "string"
                                                    ? field.state.meta.errors[0]
                                                    : field.state.meta.errors[0]?.message || "Invalid value"}
                                            </p>
                                        )}
                                </Field>
                            )}
                        </form.Field>


                        {/* Parent Area */}
                        <form.Field name="parentId">
                            {(field) => (
                                <Field>
                                    <FieldLabel className="text-xs">Parent Area</FieldLabel>
                                    <Select
                                        value={field.state.value?.toString() || "none"}
                                        onValueChange={(value) =>
                                            field.handleChange(
                                                value === "none" ? null : parseInt(value),
                                            )
                                        }
                                    >
                                        <SelectTrigger className="h-9">
                                            <SelectValue placeholder="None (top-level)" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">None (Top Level)</SelectItem>
                                            {parentAreas
                                                .filter((p: { id: number }) => p.id !== area?.id)
                                                .map((p: { id: number; name: string }) => (
                                                    <SelectItem key={p.id} value={p.id.toString()}>
                                                        {p.name}
                                                    </SelectItem>
                                                ))}
                                        </SelectContent>
                                    </Select>
                                </Field>
                            )}
                        </form.Field>
                    </div>

                    {/* ── Map (Main Focus) ── */}
                    <div className="border rounded-lg p-2 space-y-2 bg-muted/30">
                        <form.Subscribe selector={(state) => ({
                            centerLat: state.values.centerLat,
                            centerLng: state.values.centerLng,
                            radiusKm: state.values.radiusKm,
                        })}>
                            {({ centerLat: lat, centerLng: lng, radiusKm: r }) => (
                                <AreaPolygonEditor
                                    polygon={polygonCoords}
                                    centerLat={lat}
                                    centerLng={lng}
                                    radiusKm={r}
                                    onPolygonChange={(coords) => setPolygonCoords(coords)}
                                    onCenterChange={(newLat, newLng) => {
                                        form.setFieldValue("centerLat", newLat);
                                        form.setFieldValue("centerLng", newLng);
                                    }}
                                    onAddressResolved={setResolvedAddress}
                                    height="280px"
                                />
                            )}
                        </form.Subscribe>

                        {/* Address + Radius — single row */}
                        <div className="flex items-center gap-3">
                            {resolvedAddress && (
                                <div className="flex-1 flex items-center gap-1.5 min-w-0">
                                    <span className="text-primary text-sm shrink-0">📍</span>
                                    <div className="text-xs min-w-0 truncate">
                                        <span className="font-medium text-foreground">{resolvedAddress.address}</span>
                                        {resolvedAddress.area && (
                                            <span className="text-muted-foreground"> • {resolvedAddress.area}</span>
                                        )}
                                    </div>
                                </div>
                            )}
                            {!resolvedAddress && <div className="flex-1" />}
                            <form.Field name="radiusKm">
                                {(field) => (
                                    <div className="flex items-center gap-2 shrink-0">
                                        <label className="text-xs text-muted-foreground">Radius (km)</label>
                                        <Input
                                            id={field.name}
                                            type="text"
                                            inputMode="decimal"
                                            value={field.state.value}
                                            onChange={(e) => field.handleChange(e.target.value)}
                                            placeholder="5"
                                            className="h-7 text-xs w-20"
                                        />
                                    </div>
                                )}
                            </form.Field>
                        </div>
                    </div>

                    {/* ── Bottom Row: Active + Sort + Actions ── */}
                    <div className="flex items-center justify-between gap-4 pt-1">
                        <div className="flex items-center gap-4">
                            <form.Field name="isActive">
                                {(field) => (
                                    <div className="flex items-center gap-2">
                                        <Switch
                                            checked={field.state.value}
                                            onCheckedChange={field.handleChange}
                                        />
                                        <Label className="text-sm">Active</Label>
                                    </div>
                                )}
                            </form.Field>

                            <form.Field name="sortOrder">
                                {(field) => (
                                    <div className="flex items-center gap-2">
                                        <Label className="text-sm text-muted-foreground">Sort</Label>
                                        <Input
                                            type="number"
                                            className="w-16 h-8"
                                            value={field.state.value}
                                            onChange={(e) =>
                                                field.handleChange(parseInt(e.target.value) || 0)
                                            }
                                        />
                                    </div>
                                )}
                            </form.Field>
                        </div>

                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => onOpenChange(false)}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" size="sm" disabled={isSubmitting}>
                                {isSubmitting && (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                )}
                                {isEditing ? "Update" : "Create"}
                            </Button>
                        </div>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

