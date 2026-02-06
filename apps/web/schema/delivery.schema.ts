import * as z from "zod";

const vehicleTypeEnum = z.enum(["bike", "car", "van", "truck"]);

// Create delivery group schema
export const createDeliveryGroupSchema = z.object({
  groupName: z.string().min(1, "Group name is required").max(100),
  invoiceIds: z
    .array(z.number().int().positive())
    .min(1, "At least one invoice is required"),
  deliverymanId: z.string().min(1, "Deliveryman is required"),
  notes: z.string().optional(),
  vehicleType: vehicleTypeEnum.optional(),
  expectedDeliveryAt: z.string().optional(), // YYYY-MM-DD or ISO
});

// Assign deliveryman schema
export const assignDeliverymanSchema = z.object({
  groupId: z.number().int().positive("Group ID is required"),
  deliverymanId: z.string().min(1, "Deliveryman is required"),
  vehicleType: vehicleTypeEnum.optional(),
  expectedDeliveryAt: z.string().optional(),
});

// Update delivery invoice sequence schema
export const updateDeliverySequenceSchema = z.object({
  groupId: z.number().int().positive("Group ID is required"),
  invoiceSequence: z.array(
    z.object({
      deliveryInvoiceId: z.number().int().positive(),
      sequence: z.number().int().min(0),
    }),
  ),
});

// Mark invoice delivered schema
export const markDeliveredSchema = z.object({
  deliveryInvoiceId: z
    .number()
    .int()
    .positive("Delivery invoice ID is required"),
  deliveryPhoto: z.string().url().optional().nullable(),
  deliveryOtp: z
    .string()
    .min(4, "OTP must be 4 digits")
    .max(4, "OTP must be 4 digits"),
});

// Mark invoice failed schema
export const markFailedSchema = z.object({
  deliveryInvoiceId: z
    .number()
    .int()
    .positive("Delivery invoice ID is required"),
  failedReason: z.string().min(1, "Reason is required"),
});

// Types
export type CreateDeliveryGroupFormValues = z.infer<
  typeof createDeliveryGroupSchema
>;
export type AssignDeliverymanFormValues = z.infer<
  typeof assignDeliverymanSchema
>;
export type UpdateDeliverySequenceFormValues = z.infer<
  typeof updateDeliverySequenceSchema
>;
export type MarkDeliveredFormValues = z.infer<typeof markDeliveredSchema>;
export type MarkFailedFormValues = z.infer<typeof markFailedSchema>;
