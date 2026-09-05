import { passwordValidation } from "@bikalpo-project/auth/password-policy";
import { z } from "zod";

export { passwordValidation };

// Consumer signup — simple, zero-friction
export const signupSchema = z
  .object({
    name: z
      .string()
      .min(2, "Name must be at least 2 characters long")
      .max(100, "Name is too long"),
    email: z.email("Please enter a valid email address"),
    phoneNumber: z
      .string()
      .min(10, "Phone number must be at least 10 digits")
      .regex(/^[0-9+\-\s()]*$/, "Invalid phone number format"),
    password: passwordValidation,
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

// Login with email + password
export const loginSchema = z.object({
  email: z.email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

// Business seller application form
export const sellerApplicationSchema = z.object({
  shopName: z
    .string()
    .min(2, "Shop name must be at least 2 characters")
    .max(100, "Shop name is too long"),
  ownerName: z
    .string()
    .min(2, "Owner name must be at least 2 characters")
    .max(100, "Owner name is too long"),
  phoneNumber: z
    .string()
    .min(10, "Phone number must be at least 10 digits")
    .regex(/^[0-9+\-\s()]*$/, "Invalid phone number format"),
  businessType: z.enum(["retail", "restaurant"]),
  shopAddress: z
    .string()
    .min(5, "Please enter a valid shop address")
    .max(500, "Address is too long"),
  tradeLicenseNumber: z.string(),
  documents: z.array(z.string()).default([]),
});

export type SignUpFormData = z.infer<typeof signupSchema>;
export type LoginFormData = z.infer<typeof loginSchema>;
export type SellerApplicationFormData = z.infer<typeof sellerApplicationSchema>;
