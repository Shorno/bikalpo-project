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
import { Textarea } from "@/components/ui/textarea";
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
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
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
                    {/* Name */}
                    <form.Field name="name">
                        {(field) => (
                            <Field>
                                <FieldLabel htmlFor={field.name}>
                                    Name *
                                </FieldLabel>
                                <Input
                                    id={field.name}
                                    value={field.state.value}
                                    onChange={(e) => {
                                        field.handleChange(e.target.value);
                                        // Auto-generate slug if not editing
                                        if (!isEditing) {
                                            form.setFieldValue(
                                                "slug",
                                                generateSlug(e.target.value),
                                            );
                                        }
                                    }}
                                    placeholder="e.g., Dhaka North"
                                />
                                {field.state.meta.isTouched &&
                                    field.state.meta.errors.length > 0 && (
                                        <p className="text-sm text-red-500">
                                            {String(field.state.meta.errors[0])}
                                        </p>
                                    )}
                            </Field>
                        )}
                    </form.Field>

                    {/* Slug */}
                    <form.Field name="slug">
                        {(field) => (
                            <Field>
                                <FieldLabel htmlFor={field.name}>
                                    Slug *
                                </FieldLabel>
                                <Input
                                    id={field.name}
                                    value={field.state.value}
                                    onChange={(e) =>
                                        field.handleChange(e.target.value)
                                    }
                                    placeholder="e.g., dhaka-north"
                                    className="font-mono text-sm"
                                />
                                {field.state.meta.isTouched &&
                                    field.state.meta.errors.length > 0 && (
                                        <p className="text-sm text-red-500">
                                            {String(field.state.meta.errors[0])}
                                        </p>
                                    )}
                            </Field>
                        )}
                    </form.Field>

                    {/* Description */}
                    <form.Field name="description">
                        {(field) => (
                            <Field>
                                <FieldLabel htmlFor={field.name}>
                                    Description
                                </FieldLabel>
                                <Textarea
                                    id={field.name}
                                    value={field.state.value}
                                    onChange={(e) =>
                                        field.handleChange(e.target.value)
                                    }
                                    placeholder="Brief description of this area"
                                    rows={2}
                                />
                            </Field>
                        )}
                    </form.Field>

                    {/* Parent Area */}
                    <form.Field name="parentId">
                        {(field) => (
                            <Field>
                                <FieldLabel>Parent Area</FieldLabel>
                                <Select
                                    value={
                                        field.state.value?.toString() || "none"
                                    }
                                    onValueChange={(value) =>
                                        field.handleChange(
                                            value === "none"
                                                ? null
                                                : parseInt(value),
                                        )
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="None (top-level)" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">
                                            None (Top Level)
                                        </SelectItem>
                                        {parentAreas
                                            .filter(
                                                (p: { id: number }) =>
                                                    p.id !== area?.id,
                                            )
                                            .map(
                                                (p: {
                                                    id: number;
                                                    name: string;
                                                }) => (
                                                    <SelectItem
                                                        key={p.id}
                                                        value={p.id.toString()}
                                                    >
                                                        {p.name}
                                                    </SelectItem>
                                                ),
                                            )}
                                    </SelectContent>
                                </Select>
                            </Field>
                        )}
                    </form.Field>

                    {/* Map + Location */}
                    <div className="border rounded-lg p-4 space-y-3">
                        <h3 className="text-sm font-medium text-muted-foreground">
                            Area Boundary & Location
                        </h3>
                        <AreaPolygonEditor
                            polygon={polygonCoords}
                            centerLat={form.getFieldValue("centerLat")}
                            centerLng={form.getFieldValue("centerLng")}
                            radiusKm={form.getFieldValue("radiusKm")}
                            onPolygonChange={(coords) => setPolygonCoords(coords)}
                            onCenterChange={(lat, lng) => {
                                form.setFieldValue("centerLat", lat);
                                form.setFieldValue("centerLng", lng);
                            }}
                            height="350px"
                        />
                        <div className="grid grid-cols-3 gap-3">
                            <form.Field name="centerLat">
                                {(field) => (
                                    <Field>
                                        <FieldLabel htmlFor={field.name}>
                                            Center Lat
                                        </FieldLabel>
                                        <Input
                                            id={field.name}
                                            type="text"
                                            inputMode="decimal"
                                            value={field.state.value}
                                            onChange={(e) =>
                                                field.handleChange(
                                                    e.target.value,
                                                )
                                            }
                                            placeholder="23.8103"
                                        />
                                    </Field>
                                )}
                            </form.Field>
                            <form.Field name="centerLng">
                                {(field) => (
                                    <Field>
                                        <FieldLabel htmlFor={field.name}>
                                            Center Lng
                                        </FieldLabel>
                                        <Input
                                            id={field.name}
                                            type="text"
                                            inputMode="decimal"
                                            value={field.state.value}
                                            onChange={(e) =>
                                                field.handleChange(
                                                    e.target.value,
                                                )
                                            }
                                            placeholder="90.4125"
                                        />
                                    </Field>
                                )}
                            </form.Field>
                            <form.Field name="radiusKm">
                                {(field) => (
                                    <Field>
                                        <FieldLabel htmlFor={field.name}>
                                            Radius (km)
                                        </FieldLabel>
                                        <Input
                                            id={field.name}
                                            type="text"
                                            inputMode="decimal"
                                            value={field.state.value}
                                            onChange={(e) =>
                                                field.handleChange(e.target.value)
                                            }
                                            placeholder="5"
                                        />
                                    </Field>
                                )}
                            </form.Field>
                        </div>
                    </div>

                    {/* Active + Sort Order */}
                    <div className="flex items-center justify-between gap-4">
                        <form.Field name="isActive">
                            {(field) => (
                                <div className="flex items-center gap-2">
                                    <Switch
                                        checked={field.state.value}
                                        onCheckedChange={field.handleChange}
                                    />
                                    <Label>Active</Label>
                                </div>
                            )}
                        </form.Field>

                        <form.Field name="sortOrder">
                            {(field) => (
                                <div className="flex items-center gap-2">
                                    <Label>Sort Order</Label>
                                    <Input
                                        type="number"
                                        className="w-20"
                                        value={field.state.value}
                                        onChange={(e) =>
                                            field.handleChange(
                                                parseInt(e.target.value) || 0,
                                            )
                                        }
                                    />
                                </div>
                            )}
                        </form.Field>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            {isEditing ? "Update" : "Create"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
