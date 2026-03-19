import { and, asc, count, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@bikalpo-project/db";
import { area, sellerAreaMapping } from "@bikalpo-project/db/schema";
import { adminProcedure } from "../index";

// ─── Input Schemas ───

const createAreaInput = z.object({
    name: z.string().min(2).max(150).trim(),
    slug: z
        .string()
        .min(2)
        .max(150)
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
        .trim(),
    description: z.string().optional(),
    parentId: z.number().int().optional().nullable(),
    /** GeoJSON polygon coordinates [[[lng, lat], ...]] */
    polygon: z.array(z.array(z.array(z.number()))).optional().nullable(),
    centerLat: z.string().optional().nullable(),
    centerLng: z.string().optional().nullable(),
    radiusKm: z.string().optional().nullable(),
    isActive: z.boolean().default(true),
    sortOrder: z.number().int().default(0),
});

const updateAreaInput = createAreaInput.partial().extend({
    id: z.number().int(),
});

// ─── Router ───

export const adminAreaRouter = {
    /**
     * List all areas with hierarchy and seller counts.
     * REST: GET /admin/areas
     */
    list: adminProcedure
        .route({
            method: "GET",
            path: "/admin/areas",
            tags: ["Admin Areas"],
            summary: "List all areas",
            description:
                "Get all areas with hierarchy info and seller counts",
        })
        .handler(async () => {
            // Get areas with seller counts
            const areas = await db
                .select({
                    id: area.id,
                    name: area.name,
                    slug: area.slug,
                    description: area.description,
                    parentId: area.parentId,
                    polygon: area.polygon,
                    centerLat: area.centerLat,
                    centerLng: area.centerLng,
                    radiusKm: area.radiusKm,
                    isActive: area.isActive,
                    sortOrder: area.sortOrder,
                    createdAt: area.createdAt,
                    updatedAt: area.updatedAt,
                    sellerCount: count(sellerAreaMapping.id),
                })
                .from(area)
                .leftJoin(
                    sellerAreaMapping,
                    and(
                        eq(sellerAreaMapping.areaId, area.id),
                        eq(sellerAreaMapping.isActive, true),
                    ),
                )
                .groupBy(area.id)
                .orderBy(asc(area.sortOrder), asc(area.name));

            return areas;
        }),

    /**
     * Get a single area by ID with full details.
     * REST: POST /admin/areas/get
     */
    getById: adminProcedure
        .route({
            method: "POST",
            path: "/admin/areas/get",
            tags: ["Admin Areas"],
            summary: "Get area by ID",
            description: "Get a single area with full details",
        })
        .input(z.object({ id: z.number().int() }))
        .handler(async ({ input }) => {
            const result = await db
                .select()
                .from(area)
                .where(eq(area.id, input.id))
                .limit(1);

            if (result.length === 0) throw new Error("Area not found");

            // Get parent area name if exists
            let parentName: string | null = null;
            if (result[0]!.parentId) {
                const parent = await db
                    .select({ name: area.name })
                    .from(area)
                    .where(eq(area.id, result[0]!.parentId))
                    .limit(1);
                parentName = parent[0]?.name ?? null;
            }

            // Get children
            const children = await db
                .select({
                    id: area.id,
                    name: area.name,
                    slug: area.slug,
                    isActive: area.isActive,
                })
                .from(area)
                .where(eq(area.parentId, input.id))
                .orderBy(asc(area.sortOrder), asc(area.name));

            // Get seller count
            const [sellerCountResult] = await db
                .select({ count: count() })
                .from(sellerAreaMapping)
                .where(
                    and(
                        eq(sellerAreaMapping.areaId, input.id),
                        eq(sellerAreaMapping.isActive, true),
                    ),
                );

            return {
                ...result[0]!,
                parentName,
                children,
                sellerCount: sellerCountResult?.count ?? 0,
            };
        }),

    /**
     * Create a new area.
     * REST: POST /admin/areas
     */
    create: adminProcedure
        .route({
            method: "POST",
            path: "/admin/areas",
            tags: ["Admin Areas"],
            summary: "Create area",
            description: "Create a new service area/zone",
        })
        .input(createAreaInput)
        .handler(async ({ input }) => {
            const [result] = await db
                .insert(area)
                .values({
                    name: input.name,
                    slug: input.slug,
                    description: input.description,
                    parentId: input.parentId,
                    polygon: input.polygon,
                    centerLat: input.centerLat,
                    centerLng: input.centerLng,
                    radiusKm: input.radiusKm,
                    isActive: input.isActive,
                    sortOrder: input.sortOrder,
                })
                .returning();

            return result;
        }),

    /**
     * Update an existing area.
     * REST: PUT /admin/areas/update
     */
    update: adminProcedure
        .route({
            method: "PUT",
            path: "/admin/areas/update",
            tags: ["Admin Areas"],
            summary: "Update area",
            description: "Update an existing area",
        })
        .input(updateAreaInput)
        .handler(async ({ input }) => {
            const { id, ...data } = input;

            const existing = await db
                .select()
                .from(area)
                .where(eq(area.id, id))
                .limit(1);

            if (existing.length === 0) throw new Error("Area not found");

            await db
                .update(area)
                .set({ ...data, updatedAt: new Date() })
                .where(eq(area.id, id));

            return { message: "Area updated successfully" };
        }),

    /**
     * Toggle area active status.
     * REST: PATCH /admin/areas/toggle-active
     */
    toggleActive: adminProcedure
        .route({
            method: "PATCH",
            path: "/admin/areas/toggle-active",
            tags: ["Admin Areas"],
            summary: "Toggle area active status",
            description: "Activate or deactivate an area",
        })
        .input(z.object({ id: z.number().int(), isActive: z.boolean() }))
        .handler(async ({ input }) => {
            await db
                .update(area)
                .set({ isActive: input.isActive, updatedAt: new Date() })
                .where(eq(area.id, input.id));

            return {
                message: `Area ${input.isActive ? "activated" : "deactivated"}`,
            };
        }),

    /**
     * Delete an area.
     * REST: DELETE /admin/areas/delete
     */
    delete: adminProcedure
        .route({
            method: "DELETE",
            path: "/admin/areas/delete",
            tags: ["Admin Areas"],
            summary: "Delete area",
            description: "Delete an area (also removes seller mappings)",
        })
        .input(z.object({ id: z.number().int() }))
        .handler(async ({ input }) => {
            const existing = await db
                .select()
                .from(area)
                .where(eq(area.id, input.id))
                .limit(1);

            if (existing.length === 0) throw new Error("Area not found");

            // Cascade will handle seller_area_mapping cleanup
            await db.delete(area).where(eq(area.id, input.id));

            return { message: "Area deleted successfully" };
        }),

    /**
     * Get top-level areas (no parent) for dropdown/selector.
     * REST: GET /admin/areas/top-level
     */
    getTopLevel: adminProcedure
        .route({
            method: "GET",
            path: "/admin/areas/top-level",
            tags: ["Admin Areas"],
            summary: "Get top-level areas",
            description: "Get areas without a parent (cities, zones)",
        })
        .handler(async () => {
            return db
                .select({
                    id: area.id,
                    name: area.name,
                    slug: area.slug,
                    isActive: area.isActive,
                })
                .from(area)
                .where(isNull(area.parentId))
                .orderBy(asc(area.sortOrder), asc(area.name));
        }),
};
