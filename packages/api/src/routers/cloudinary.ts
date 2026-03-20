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
        file: z.string().min(1),
        folder: z.string().default("uploads"),
      }),
    )
    .handler(async ({ input }) => {
      const { file: dataUri, folder } = input;

      if (!dataUri.startsWith("data:")) {
        return {
          success: false as const,
          error: "Invalid file data. The file must be a base64 data URL.",
          url: "",
          publicId: "",
        };
      }

      const dataUrlMatch = dataUri.match(
        /^data:(image\/(jpeg|jpg|png|webp));base64,(.+)$/,
      );
      if (!dataUrlMatch) {
        return {
          success: false as const,
          error: "Invalid image format. Only JPG, PNG, and WebP are allowed.",
          url: "",
          publicId: "",
        };
      }

      const mimeType = dataUrlMatch[1];
      const base64String = dataUrlMatch[3];
      const buffer = Buffer.from(base64String, "base64");

      // Validate file size (10MB)
      const maxSize = 10 * 1024 * 1024;
      if (buffer.length > maxSize) {
        return {
          success: false as const,
          error: "File too large. Please upload files smaller than 10MB.",
          url: "",
          publicId: "",
        };
      }

      // Use upload() with data URI
      const result = await cloudinary.uploader.upload(dataUri, {
        folder,
        resource_type: "auto",
        transformation: [{ quality: "auto:good" }, { fetch_format: "auto" }],
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
