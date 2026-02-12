import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";
import { z } from "zod";

import { env } from "@bikalpo-project/env/server";

import { protectedProcedure } from "../index";

// Configure Cloudinary
cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
});

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

            // Validate file size (5MB)
            const maxSize = 5 * 1024 * 1024;
            if (file.size > maxSize) {
                return {
                    success: false as const,
                    error: "File too large. Please upload files smaller than 5MB.",
                    url: "",
                    publicId: "",
                };
            }

            const bytes = await file.arrayBuffer();
            const buffer = Buffer.from(bytes);

            const result = await new Promise<UploadApiResponse>(
                (resolve, reject) => {
                    cloudinary.uploader
                        .upload_stream(
                            {
                                folder,
                                resource_type: "auto",
                                transformation: [
                                    { quality: "auto:good" },
                                    { fetch_format: "auto" },
                                ],
                            },
                            (error, result) => {
                                if (error) reject(error);
                                else if (result) resolve(result);
                                else reject(new Error("Unknown Cloudinary error"));
                            },
                        )
                        .end(buffer);
                },
            );

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
