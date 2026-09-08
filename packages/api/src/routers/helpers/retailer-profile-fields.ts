import { z } from "zod";

export const retailerThanaSchema = z.string().trim().max(100).nullable().optional();

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
    if ((value.openingTime === undefined) !== (value.closingTime === undefined)) {
      ctx.addIssue({
        code: "custom",
        message: "Opening and closing times must be provided together",
        path: value.openingTime === undefined ? ["openingTime"] : ["closingTime"],
      });
    } else if ((value.openingTime === null) !== (value.closingTime === null)) {
      ctx.addIssue({
        code: "custom",
        message: "Set both opening and closing times, or leave both empty",
        path: value.openingTime === null ? ["openingTime"] : ["closingTime"],
      });
    }
  });
