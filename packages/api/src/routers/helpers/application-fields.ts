import { ORPCError } from "@orpc/server";
import { db } from "@bikalpo-project/db";
import { productType, sellerApplication, warehouseApplication } from "@bikalpo-project/db/schema";
import { and, eq, like, sql } from "drizzle-orm";
import { z } from "zod";

import { BUSINESS_NATURES } from "../../business-registration";

export { BUSINESS_NATURES };

export const documentUrlsSchema = z.object({
    tradeLicense: z.string().optional(),
    nid: z.string().optional(),
    shopPhoto: z.string().optional(),
    storeFront: z.string().optional(),
    warehouse: z.string().optional(),
});

export const sharedApplicationFieldsSchema = z.object({
    ownerName: z.string().min(2).max(100),
    phoneNumber: z.string().min(10),
    tradeLicenseNumber: z.string().optional(),
    documents: z.array(z.string()).optional(),
    documentUrls: documentUrlsSchema.optional(),
    // Applicant profile
    profilePhotoUrl: z.string().optional(),
    email: z.string().email().optional().or(z.literal("")),
    dateOfBirth: z.string().optional(),
    gender: z.enum(["male", "female", "other"]).optional(),
    personalAddress: z.string().optional(),
    personalLatitude: z.string().optional(),
    personalLongitude: z.string().optional(),
    personalArea: z.string().optional(),
    personalDistrict: z.string().optional(),
    personalDivision: z.string().optional(),
    personalPostCode: z.string().optional(),
    // Business profile
    businessNature: z.enum(BUSINESS_NATURES).optional(),
    productTypeId: z.number().int().positive().optional(),
    yearsInBusiness: z.string().optional(),
    monthlyRevenue: z.string().optional(),
    binNumber: z.string().optional(),
    tinNumber: z.string().optional(),
    // Business location
    latitude: z.string().optional(),
    longitude: z.string().optional(),
    area: z.string().optional(),
    district: z.string().optional(),
    division: z.string().optional(),
    postCode: z.string().optional(),
    // Plan
    selectedPlan: z.string().optional(),
    // Bank & referral
    bankName: z.string().optional(),
    bankAccountName: z.string().optional(),
    bankAccountNumber: z.string().optional(),
    referralId: z.string().optional(),
    referralName: z.string().optional(),
    referralPhone: z.string().optional(),
    // Social
    facebookUrl: z.string().optional(),
    whatsappNumber: z.string().optional(),
    instagramUrl: z.string().optional(),
    websiteUrl: z.string().optional(),
    tiktokUrl: z.string().optional(),
    twitterUrl: z.string().optional(),
});

export type SharedApplicationInput = z.infer<typeof sharedApplicationFieldsSchema>;

export async function resolveActiveProductType(productTypeId: number) {
    const type = await db.query.productType.findFirst({
        where: and(eq(productType.id, productTypeId), eq(productType.isActive, true)),
        columns: { id: true, name: true },
    });

    if (!type) {
        throw new ORPCError("BAD_REQUEST", {
            message: "Selected product type is invalid or inactive",
        });
    }

    return type;
}

export async function generateApplicationNumber(prefix: "SELLER" | "WAREHOUSE") {
    const year = new Date().getFullYear();
    const pattern = `${prefix}-${year}-%`;
    const table = prefix === "SELLER" ? sellerApplication : warehouseApplication;
    const numberColumn =
        prefix === "SELLER"
            ? sellerApplication.applicationNumber
            : warehouseApplication.applicationNumber;

    const [row] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(table)
        .where(like(numberColumn, pattern));

    const seq = (row?.count ?? 0) + 1;
    return `${prefix}-${year}-${String(seq).padStart(6, "0")}`;
}

export function buildSharedApplicationValues(
    input: SharedApplicationInput,
    businessCategory?: string | null,
) {
    return {
        ownerName: input.ownerName,
        phoneNumber: input.phoneNumber,
        tradeLicenseNumber: input.tradeLicenseNumber || null,
        documents: input.documents || [],
        documentUrls: input.documentUrls || null,
        profilePhotoUrl: input.profilePhotoUrl || null,
        email: input.email || null,
        dateOfBirth: input.dateOfBirth || null,
        gender: input.gender || null,
        personalAddress: input.personalAddress || null,
        personalLatitude: input.personalLatitude || null,
        personalLongitude: input.personalLongitude || null,
        personalArea: input.personalArea || null,
        personalDistrict: input.personalDistrict || null,
        personalDivision: input.personalDivision || null,
        personalPostCode: input.personalPostCode || null,
        businessNature: input.businessNature || null,
        productTypeId: input.productTypeId || null,
        businessCategory: businessCategory || null,
        yearsInBusiness: input.yearsInBusiness || null,
        monthlyRevenue: input.monthlyRevenue || null,
        binNumber: input.binNumber || null,
        tinNumber: input.tinNumber || null,
        latitude: input.latitude || null,
        longitude: input.longitude || null,
        area: input.area || null,
        district: input.district || null,
        division: input.division || null,
        postCode: input.postCode || null,
        selectedPlan: input.selectedPlan || "free_trial",
        bankName: input.bankName || null,
        bankAccountName: input.bankAccountName || null,
        bankAccountNumber: input.bankAccountNumber || null,
        referralId: input.referralId || null,
        referralName: input.referralName || null,
        referralPhone: input.referralPhone || null,
        facebookUrl: input.facebookUrl || null,
        whatsappNumber: input.whatsappNumber || null,
        instagramUrl: input.instagramUrl || null,
        websiteUrl: input.websiteUrl || null,
        tiktokUrl: input.tiktokUrl || null,
        twitterUrl: input.twitterUrl || null,
    };
}
