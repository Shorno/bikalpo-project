import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
    server: {
        DATABASE_URL: z.string().min(1),
        BETTER_AUTH_SECRET: z.string().min(32),
        BETTER_AUTH_URL: z.url(),
        CORS_ORIGINS: z
            .string()
            .min(1)
            .transform((val) => val.split(",").map((s) => s.trim())),
        COOKIE_DOMAIN: z.string().optional(),
        NODE_ENV: z
            .enum(["development", "production", "test"])
            .default("development"),
        CLOUDINARY_CLOUD_NAME: z.string().min(1),
        CLOUDINARY_API_KEY: z.string().min(1),
        CLOUDINARY_API_SECRET: z.string().min(1),
        BARIKOI_API_KEY: z.string().min(1),
        // Dummy OTP mode: no SMS gateway yet, so OTP codes are returned to the
        // frontend and auto-filled (same as the login page). Set to "false" once a
        // real SMS provider is integrated.
        DUMMY_OTP_ENABLED: z
            .enum(["true", "false"])
            .default("true")
            .transform((v) => v === "true"),
    },
    runtimeEnv: process.env,
    emptyStringAsUndefined: true,
});
