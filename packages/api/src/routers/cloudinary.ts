import { env } from "@bikalpo-project/env/server";
import { v2 as cloudinary } from "cloudinary";
import { z } from "zod";

import { protectedProcedure } from "../index";

const TOLET_PROPERTY_VIDEO_FOLDER = "to-let/property-videos";
const MAX_TOLET_VIDEO_BYTES = 100 * 1024 * 1024;
const MAX_TOLET_VIDEO_SECONDS = 90;
const ALLOWED_TOLET_VIDEO_FORMATS = new Set(["mp4", "webm", "mov"]);

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

      const base64String = dataUrlMatch[3];
      if (!base64String) {
        return {
          success: false as const,
          error: "Invalid image data.",
          url: "",
          publicId: "",
        };
      }
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

  createVideoUploadSignature: protectedProcedure
    .route({
      method: "POST",
      path: "/cloudinary/video-upload-signature",
      tags: ["Cloudinary"],
      summary: "Create a signed To-Let video upload",
      description:
        "Create short-lived credentials for a direct browser-to-Cloudinary video upload",
    })
    .input(z.object({}))
    .handler(async () => {
      ensureCloudinaryConfig();
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = cloudinary.utils.api_sign_request(
        {
          folder: TOLET_PROPERTY_VIDEO_FOLDER,
          timestamp,
        },
        env.CLOUDINARY_API_SECRET,
      );

      return {
        cloudName: env.CLOUDINARY_CLOUD_NAME,
        apiKey: env.CLOUDINARY_API_KEY,
        folder: TOLET_PROPERTY_VIDEO_FOLDER,
        timestamp,
        signature,
      };
    }),

  finalizeVideoUpload: protectedProcedure
    .route({
      method: "POST",
      path: "/cloudinary/video-upload-finalize",
      tags: ["Cloudinary"],
      summary: "Validate a To-Let video upload",
      description:
        "Verify duration, format and size after a direct Cloudinary video upload",
    })
    .input(
      z.object({
        publicId: z
          .string()
          .min(1)
          .refine(
            (value) => value.startsWith(`${TOLET_PROPERTY_VIDEO_FOLDER}/`),
            "Invalid video folder",
          ),
      }),
    )
    .handler(async ({ input }) => {
      ensureCloudinaryConfig();

      try {
        const resource = await cloudinary.api.resource(input.publicId, {
          resource_type: "video",
        });
        const duration = Number(resource.duration ?? 0);
        const bytes = Number(resource.bytes ?? 0);
        const format = String(resource.format ?? "").toLowerCase();
        const valid =
          duration > 0 &&
          duration <= MAX_TOLET_VIDEO_SECONDS &&
          bytes > 0 &&
          bytes <= MAX_TOLET_VIDEO_BYTES &&
          ALLOWED_TOLET_VIDEO_FORMATS.has(format);

        if (!valid) {
          await cloudinary.uploader.destroy(input.publicId, {
            resource_type: "video",
            invalidate: true,
          });
          return {
            success: false as const,
            error:
              "Video must be MP4, WebM or MOV, no longer than 90 seconds, and smaller than 100MB.",
            url: "",
          };
        }

        return {
          success: true as const,
          error: "",
          url: String(resource.secure_url),
          duration,
        };
      } catch (error) {
        console.error("Cloudinary video validation failed:", error);
        return {
          success: false as const,
          error: "Could not validate the uploaded video.",
          url: "",
        };
      }
    }),

  /**
   * Delete image from Cloudinary
   */
  delete: protectedProcedure
    .route({
      method: "POST",
      path: "/cloudinary/delete",
      tags: ["Cloudinary"],
      summary: "Delete uploaded media",
      description: "Delete an image or video from Cloudinary by public ID",
    })
    .input(
      z.object({
        publicId: z.string().min(1),
        resourceType: z.enum(["image", "video"]).default("image"),
      }),
    )
    .handler(async ({ input }) => {
      ensureCloudinaryConfig();
      const result = await cloudinary.uploader.destroy(input.publicId, {
        resource_type: input.resourceType,
        invalidate: true,
      });

      return {
        success: result.result === "ok",
        message:
          result.result === "ok"
            ? "Image deleted successfully"
            : "Failed to delete image",
      };
    }),
};
