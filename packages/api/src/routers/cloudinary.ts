import { v2 as cloudinary } from "cloudinary";
import { z } from "zod";

import { env } from "@bikalpo-project/env/server";

import { protectedProcedure } from "../index";

function ensureCloudinaryConfig() {
    cloudinary.config({
        cloud_name: env.CLOUDINARY_CLOUD_NAME,
        api_key: env.CLOUDINARY_API_KEY,
        api_secret: env.CLOUDINARY_API_SECRET,
    });
}

export const cloudinaryRouter = {
    /**
     * Upload image to Cloudinary
     * Accepts a File object and optional folder name
     */
    upload: protectedProcedure
        .route({
            method: "POST",
            path: "/cloudinary/upload",
            tags: ["Cloudinary"],
            summary: "Upload image",
            description: "Upload an image to Cloudinary",
        })
        .input(
            z.object({
                file: z.instanceof(File),
                folder: z.string().default("uploads"),
            }),
        )
        .handler(async ({ input }) => {
            const { file, folder } = input;

            // Validate file type
            const allowedTypes = [
                "image/jpeg",
                "image/jpg",
                "image/png",
                "image/webp",
            ];
            if (!allowedTypes.includes(file.type)) {
                return {
                    success: false as const,
                    error:
                        "Invalid file type. Please upload JPG, PNG, or WebP files.",
                    url: "",
                    publicId: "",
                };
            }

            // Validate file size (10MB)
            const maxSize = 10 * 1024 * 1024;
            if (file.size > maxSize) {
                return {
                    success: false as const,
                    error: "File too large. Please upload files smaller than 10MB.",
                    url: "",
                    publicId: "",
                };
            }

            const bytes = await file.arrayBuffer();
            const buffer = Buffer.from(bytes);
            const base64 = buffer.toString("base64");
            const dataUri = `data:${file.type};base64,${base64}`;

            // Use upload() with data URI — more reliable than upload_stream in Bun
            const result = await cloudinary.uploader.upload(dataUri, {
                folder,
                resource_type: "auto",
                transformation: [
                    { quality: "auto:good" },
                    { fetch_format: "auto" },
                ],
                cloud_name: env.CLOUDINARY_CLOUD_NAME,
                api_key: env.CLOUDINARY_API_KEY,
                api_secret: env.CLOUDINARY_API_SECRET,
            });

            return {
                success: true as const,
                url: result.secure_url,
                publicId: result.public_id,
                error: "",
            };
        }),

    /**
     * Delete image from Cloudinary
     */
    delete: protectedProcedure
        .route({
            method: "POST",
            path: "/cloudinary/delete",
            tags: ["Cloudinary"],
            summary: "Delete image",
            description: "Delete an image from Cloudinary by public ID",
        })
        .input(
            z.object({
                publicId: z.string().min(1),
            }),
        )
        .handler(async ({ input }) => {
            ensureCloudinaryConfig();
            const result = await cloudinary.uploader.destroy(input.publicId);

            return {
                success: result.result === "ok",
                message:
                    result.result === "ok"
                        ? "Image deleted successfully"
                        : "Failed to delete image",
            };
        }),
};
