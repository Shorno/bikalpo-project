import { z } from "zod";

const httpUrl = z.string().trim().pipe(z.httpUrl());
const optionalUrl = z.union([z.literal(""), httpUrl]);
const money = z.coerce
  .number()
  .finite("Enter a valid amount")
  .min(0, "Amount cannot be negative")
  .max(1_000_000_000);

export const listingVisibilityOptions = [
  {
    value: "public",
    label: "Public",
    description:
      "Shown on the To-Let landing page, search, map and the permanent QR page.",
  },
  {
    value: "qr_only",
    label: "QR Only",
    description:
      "Hidden from browse/search and visible only through the QR page.",
  },
] as const;

export const preferredTenantOptions = [
  { value: "any", label: "Any" },
  { value: "family", label: "Family" },
  { value: "bachelor", label: "Bachelor" },
  { value: "female", label: "Female" },
  { value: "office", label: "Office" },
] as const;

export const listingDraftSchema = z.object({
  title: z.string().trim().min(5, "Listing title is required").max(200),
  description: z.string().trim().max(5000),
  monthlyRent: money.min(1, "Monthly rent is required"),
  monthlyRentVisible: z.boolean(),
  advanceAmount: money,
  advanceAmountVisible: z.boolean(),
  securityDeposit: money,
  securityDepositVisible: z.boolean(),
  serviceCharge: money,
  serviceChargeVisible: z.boolean(),
  serviceChargeIncluded: z.boolean(),
  parkingCharge: money,
  parkingChargeVisible: z.boolean(),
  parkingChargeIncluded: z.boolean(),
  utilityCharge: money,
  utilityChargeVisible: z.boolean(),
  utilityChargeIncluded: z.boolean(),
  availableFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose an available date"),
  preferredTenant: z.enum(["family", "bachelor", "office", "female", "any"]),
  hasInternet: z.boolean(),
  otherFacilities: z.string().trim().max(2000),
  imageUrls: z.array(httpUrl).max(12),
  videoUrl: optionalUrl,
  visibility: z.enum(["public", "qr_only"]),
});

export const listingPublishSchema = listingDraftSchema.extend({
  imageUrls: z
    .array(httpUrl)
    .min(1, "Add at least one listing photo before publishing")
    .max(12),
});

export type ToLetListingFormValues = z.infer<typeof listingDraftSchema>;
