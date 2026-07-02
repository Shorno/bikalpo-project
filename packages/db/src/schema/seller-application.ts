import { relations } from "drizzle-orm";
import { index, integer, json, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { user } from "./auth-schema";
import { productType } from "./product-type";

export type ApplicationDocumentUrls = {
    tradeLicense?: string;
    nid?: string;
    shopPhoto?: string;
    storeFront?: string;
    warehouse?: string;
};

export const sellerApplication = pgTable(
    "seller_application",
    {
        id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
        userId: text("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        applicationNumber: text("application_number"),
        // Business details
        shopName: text("shop_name").notNull(),
        ownerName: text("owner_name").notNull(),
        phoneNumber: text("phone_number").notNull(),
        businessType: text("business_type").notNull(), // retail | restaurant
        shopAddress: text("shop_address").notNull(),
        tradeLicenseNumber: text("trade_license_number"),
        // Applicant profile
        profilePhotoUrl: text("profile_photo_url"),
        email: text("email"),
        dateOfBirth: text("date_of_birth"),
        gender: text("gender"),
        personalAddress: text("personal_address"),
        personalLatitude: text("personal_latitude"),
        personalLongitude: text("personal_longitude"),
        personalArea: text("personal_area"),
        personalDistrict: text("personal_district"),
        personalDivision: text("personal_division"),
        personalPostCode: text("personal_post_code"),
        // Business profile
        businessNature: text("business_nature"),
        productTypeId: integer("product_type_id").references(() => productType.id),
        businessCategory: text("business_category"),
        yearsInBusiness: text("years_in_business"),
        monthlyRevenue: text("monthly_revenue"),
        binNumber: text("bin_number"),
        tinNumber: text("tin_number"),
        // Location (business — Barikoi)
        latitude: text("latitude"),
        longitude: text("longitude"),
        area: text("area"),
        district: text("district"),
        division: text("division"),
        postCode: text("post_code"),
        // Plan selection
        selectedPlan: text("selected_plan"),
        // Documents
        documents: json("documents").$type<string[]>().default([]),
        documentUrls: json("document_urls").$type<ApplicationDocumentUrls>(),
        // Bank & referral
        bankName: text("bank_name"),
        bankAccountName: text("bank_account_name"),
        bankAccountNumber: text("bank_account_number"),
        referralId: text("referral_id"),
        referralName: text("referral_name"),
        referralPhone: text("referral_phone"),
        // Social
        facebookUrl: text("facebook_url"),
        whatsappNumber: text("whatsapp_number"),
        instagramUrl: text("instagram_url"),
        websiteUrl: text("website_url"),
        tiktokUrl: text("tiktok_url"),
        twitterUrl: text("twitter_url"),
        // Application status
        status: text("status").default("pending").notNull(), // pending | approved | rejected
        // Admin review
        adminNotes: text("admin_notes"),
        reviewedBy: text("reviewed_by").references(() => user.id),
        reviewedAt: timestamp("reviewed_at"),
        // Timestamps
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at")
            .defaultNow()
            .$onUpdate(() => /* @__PURE__ */ new Date())
            .notNull(),
    },
    (table) => [
        index("seller_application_userId_idx").on(table.userId),
        index("seller_application_status_idx").on(table.status),
        uniqueIndex("seller_application_number_idx").on(table.applicationNumber),
    ],
);

export const sellerApplicationRelations = relations(sellerApplication, ({ one }) => ({
    user: one(user, {
        fields: [sellerApplication.userId],
        references: [user.id],
    }),
    reviewer: one(user, {
        fields: [sellerApplication.reviewedBy],
        references: [user.id],
        relationName: "applicationReviewer",
    }),
    productType: one(productType, {
        fields: [sellerApplication.productTypeId],
        references: [productType.id],
    }),
}));
