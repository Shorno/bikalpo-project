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
    DialogDescription,
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
    centerLat: z.string().optional().nullable(),
    centerLng: z.string().optional().nullable(),
    radiusKm: z.string().optional().nullable(),
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
        validators: {
            onSubmit: formSchema,
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
            <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {isEditing ? "Edit Area" : "New Area"}
                    </DialogTitle>
                    <DialogDescription>
                        {isEditing
                            ? "Update the area details below."
                            : "Define a new service area or zone for seller assignment."}
                    </DialogDescription>
                </DialogHeader>

                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        form.handleSubmit();
                    }}
                    className="space-y-4"
                >
                    {/* ── Compact Info Grid ── */}
                    <div className="grid grid-cols-2 gap-3">
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

                        {/* Description */}
                        <form.Field name="description">
                            {(field) => (
                                <Field>
                                    <FieldLabel htmlFor={field.name} className="text-xs">
                                        Description
                                    </FieldLabel>
                                    <Input
                                        id={field.name}
                                        value={field.state.value}
                                        onChange={(e) => field.handleChange(e.target.value)}
                                        placeholder="Brief description"
                                        className="h-9"
                                    />
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
                    <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
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
                                    height="400px"
                                />
                            )}
                        </form.Subscribe>

                        {/* Lat/Lng/Radius — inline row below map */}
                        <div className="grid grid-cols-3 gap-2">
                            <form.Field name="centerLat">
                                {(field) => (
                                    <div className="flex items-center gap-2">
                                        <label className="text-xs text-muted-foreground shrink-0 w-8">Lat</label>
                                        <Input
                                            id={field.name}
                                            type="text"
                                            inputMode="decimal"
                                            value={field.state.value}
                                            onChange={(e) => field.handleChange(e.target.value)}
                                            placeholder="23.8103"
                                            className="h-8 text-xs"
                                        />
                                    </div>
                                )}
                            </form.Field>
                            <form.Field name="centerLng">
                                {(field) => (
                                    <div className="flex items-center gap-2">
                                        <label className="text-xs text-muted-foreground shrink-0 w-8">Lng</label>
                                        <Input
                                            id={field.name}
                                            type="text"
                                            inputMode="decimal"
                                            value={field.state.value}
                                            onChange={(e) => field.handleChange(e.target.value)}
                                            placeholder="90.4125"
                                            className="h-8 text-xs"
                                        />
                                    </div>
                                )}
                            </form.Field>
                            <form.Field name="radiusKm">
                                {(field) => (
                                    <div className="flex items-center gap-2">
                                        <label className="text-xs text-muted-foreground shrink-0 w-14">Radius</label>
                                        <Input
                                            id={field.name}
                                            type="text"
                                            inputMode="decimal"
                                            value={field.state.value}
                                            onChange={(e) => field.handleChange(e.target.value)}
                                            placeholder="5 km"
                                            className="h-8 text-xs"
                                        />
                                    </div>
                                )}
                            </form.Field>
                        </div>
                    </div>

                    {/* ── Bottom Row: Active + Sort + Actions ── */}
                    <div className="flex items-center justify-between gap-4 pt-2">
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

