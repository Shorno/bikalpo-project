import { z } from "zod";

export const retailerThanaSchema = z
  .string()
  .trim()
  .max(100)
  .nullable()
  .optional();
export const retailerRequiredThanaSchema = z
  .string()
  .trim()
  .min(2, "Upazila / Thana is required")
  .max(150);

export const retailerBusinessLocationSchema = z.object({
  division: z.string().trim().min(2, "Division is required").max(100),
  district: z.string().trim().min(2, "District is required").max(100),
  thana: retailerRequiredThanaSchema,
  area: z.string().trim().min(2, "Area is required").max(150),
});

const optionalHttpUrlSchema = z
  .string()
  .trim()
  .url()
  .max(2048)
  .refine((value) => /^https?:\/\//i.test(value), {
    message: "URL must use http or https",
  })
  .nullable()
  .optional();

const nullableHttpUrlSchema = z
  .string()
  .trim()
  .url()
  .max(2048)
  .refine((value) => /^https?:\/\//i.test(value), {
    message: "URL must use http or https",
  })
  .nullable();

const nullableText = (max: number) => z.string().trim().max(max).nullable();

const bangladeshCoordinates = z
  .object({
    latitude: z.number().min(20.5).max(26.7).nullable(),
    longitude: z.number().min(87.9).max(92.7).nullable(),
  })
  .refine((value) => (value.latitude === null) === (value.longitude === null), {
    message: "Latitude and longitude must be provided together",
    path: ["longitude"],
  });

export const retailerBusinessContactInformationSchema = z.object({
  phoneNumber: z.string().trim().min(10).max(20),
  email: z.string().trim().email().max(320).nullable(),
  whatsappNumber: z.string().trim().max(20).nullable(),
  facebookUrl: z.string().trim().url().max(2048).nullable(),
  messengerUrl: optionalHttpUrlSchema,
  telegramUrl: optionalHttpUrlSchema,
  instagramUrl: z.string().trim().url().max(2048).nullable().optional(),
  websiteUrl: z.string().trim().url().max(2048).nullable(),
});

export const retailerShopProfileSchema = z
  .object({
    shopLogo: z
      .string()
      .url("Shop logo must be a valid URL")
      .max(2048)
      .nullable()
      .optional(),
    openingTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Opening time must use HH:mm format")
      .nullable()
      .optional(),
    closingTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Closing time must use HH:mm format")
      .nullable()
      .optional(),
  })
  .refine(
    (value) => Object.values(value).some((field) => field !== undefined),
    { message: "Provide a logo or operating hours to update" },
  )
  .superRefine((value, ctx) => {
    if (
      (value.openingTime === undefined) !==
      (value.closingTime === undefined)
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Opening and closing times must be provided together",
        path:
          value.openingTime === undefined ? ["openingTime"] : ["closingTime"],
      });
    } else if ((value.openingTime === null) !== (value.closingTime === null)) {
      ctx.addIssue({
        code: "custom",
        message: "Set both opening and closing times, or leave both empty",
        path: value.openingTime === null ? ["openingTime"] : ["closingTime"],
      });
    }
  });

/** Complete post-approval registration profile contract for a Shop Owner. */
export const retailerRegistrationProfileSchema = z.object({
  applicant: z
    .object({
      profilePhotoUrl: nullableHttpUrlSchema,
      ownerName: z.string().trim().min(2).max(100),
      dateOfBirth: nullableText(10),
      gender: z.enum(["male", "female", "other"]).nullable(),
      personalAddress: nullableText(500),
      personalArea: nullableText(100),
      personalDistrict: nullableText(100),
      personalDivision: nullableText(100),
      personalPostCode: nullableText(20),
      personalLatitude: z.number().min(20.5).max(26.7).nullable(),
      personalLongitude: z.number().min(87.9).max(92.7).nullable(),
    })
    .refine(
      (value) =>
        (value.personalLatitude === null) ===
        (value.personalLongitude === null),
      {
        message: "Latitude and longitude must be provided together",
        path: ["personalLongitude"],
      },
    ),
  business: z
    .object({
      shopLogo: nullableHttpUrlSchema,
      shopName: z.string().trim().min(2).max(150),
      businessType: z.enum(["retail", "restaurant"]),
      productTypeId: z.number().int().positive().nullable(),
      businessNature: z
        .enum(["retail_shop", "manufacturer", "importer"])
        .nullable(),
      yearsInBusiness: nullableText(100),
      monthlyRevenue: nullableText(100),
      binNumber: nullableText(100),
      tinNumber: nullableText(100),
      tradeLicenseNumber: nullableText(100),
      shopAddress: z.string().trim().min(5).max(500),
      ...retailerBusinessLocationSchema.shape,
      postCode: nullableText(20),
    })
    .and(bangladeshCoordinates),
  contacts: z.object({
    phoneNumber: z.string().trim().min(10).max(20),
    email: z.string().trim().email().max(320).nullable(),
    whatsappNumber: nullableText(20),
    facebookUrl: nullableHttpUrlSchema,
    messengerUrl: nullableHttpUrlSchema,
    instagramUrl: nullableHttpUrlSchema,
    websiteUrl: nullableHttpUrlSchema,
    telegramUrl: nullableHttpUrlSchema,
    tiktokUrl: nullableHttpUrlSchema,
    twitterUrl: nullableHttpUrlSchema,
  }),
  documents: z.object({
    tradeLicense: nullableHttpUrlSchema,
    nid: nullableHttpUrlSchema,
    shopPhoto: nullableHttpUrlSchema,
    storeFront: nullableHttpUrlSchema,
    warehouse: nullableHttpUrlSchema,
  }),
});

export type RetailerRegistrationProfileInput = z.infer<
  typeof retailerRegistrationProfileSchema
>;
