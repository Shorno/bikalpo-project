"use client";

import { AlertCircleIcon, ImageUpIcon, LoaderIcon, XIcon } from "lucide-react";
import { CldImage } from "next-cloudinary";
import React, { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  deleteImageFromCloudinary,
  uploadImageToCloudinary,
} from "@/actions/cloudinary";
import { getPublicIdFromUrl } from "@/utils/getPublicIdFromUrl";

interface ImageUploaderProps {
  value?: string;
  onChange?: (url: string) => void;
  folder?: string;
  maxSizeMB?: number;
  className?: string;
  disabled?: boolean;
}

export default function ImageUploader({
  value = "",
  onChange,
  folder = "categories",
  maxSizeMB = 5,
  className = "",
  disabled = false,
}: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>(value);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();

  React.useEffect(() => {
    setPreviewUrl(value);
  }, [value]);

  const handleFileUpload = useCallback(
    async (file: File) => {
      setError(null);

      // Client-side validation
      const maxSize = maxSizeMB * 1024 * 1024;
      if (file.size > maxSize) {
        const errorMsg = `File too large. Please upload files smaller than ${maxSizeMB}MB.`;
        setError(errorMsg);
        toast.error(errorMsg);
        return;
      }

      startTransition(async () => {
        try {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("folder", folder);

          const result = await uploadImageToCloudinary(formData);

          if (result.success) {
            setPreviewUrl(result.url);
            onChange?.(result.url);
            toast.success("Image uploaded successfully!");
          } else {
            setError(result.error);
            toast.error(result.error);
          }
        } catch (error) {
          const errorMessage = "Failed to upload image. Please try again.";
          setError(errorMessage);
          toast.error(errorMessage);
          console.error("Upload error:", error);
        }
      });
    },
    [folder, maxSizeMB, onChange],
  );

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) setIsDragging(true);
    },
    [disabled],
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (disabled) return;

      const files = Array.from(e.dataTransfer.files);
      const imageFile = files.find((file) => file.type.startsWith("image/"));

      if (imageFile) {
        handleFileUpload(imageFile);
      } else {
        toast.error("Please drop an image file");
      }
    },
    [disabled, handleFileUpload],
  );

  const openFileDialog = useCallback(() => {
    if (disabled || isPending || isDeleting) return;

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/svg+xml,image/png,image/jpeg,image/jpg,image/webp";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) handleFileUpload(file);
    };
    input.click();
  }, [disabled, isPending, isDeleting, handleFileUpload]);

  const removeImage = useCallback(() => {
    if (!previewUrl || disabled) return;

    const publicId = getPublicIdFromUrl(previewUrl);

    if (publicId) {
      startDeleteTransition(async () => {
        try {
          const result = await deleteImageFromCloudinary(publicId);

          if (result.success) {
            setPreviewUrl("");
            onChange?.("");
            setError(null);
            toast.success("Image deleted successfully");
          } else {
            toast.error(result.error || "Failed to delete image");
          }
        } catch (error) {
          console.error("Delete error:", error);
          toast.error("Failed to delete image");
        }
      });
    } else {
      // Just clear preview if no public ID
      setPreviewUrl("");
      onChange?.("");
      setError(null);
    }
  }, [previewUrl, onChange, disabled]);

  const isLoading = isPending || isDeleting;

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          onClick={openFileDialog}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openFileDialog();
            }
          }}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          data-dragging={isDragging || undefined}
          data-disabled={disabled || undefined}
          className={`
                        relative flex min-h-52 flex-col items-center justify-center 
                        overflow-hidden rounded-xl border-2 border-dashed border-input 
                        p-4 transition-all duration-200
                        ${!disabled && !isLoading ? "cursor-pointer hover:border-primary hover:bg-accent/50" : ""}
                        ${isDragging ? "border-primary bg-accent/50 scale-[0.98]" : ""}
                        ${disabled ? "opacity-50 cursor-not-allowed" : ""}
                        ${previewUrl ? "border-solid" : ""}
                        ${className}
                    `}
          aria-label={previewUrl ? "Change image" : "Upload image"}
          aria-disabled={disabled}
        >
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-3">
              <LoaderIcon className="size-10 animate-spin text-primary" />
              <p className="text-sm font-medium text-muted-foreground">
                {isPending ? "Uploading..." : "Deleting..."}
              </p>
            </div>
          ) : previewUrl ? (
            <div className="absolute inset-0 p-2">
              <CldImage
                src={previewUrl}
                alt="Uploaded preview"
                fill
                className="object-contain rounded-lg"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                crop="fill"
                gravity="auto"
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center space-y-3">
              <div
                className="flex size-12 items-center justify-center rounded-full border-2 bg-background shadow-sm"
                aria-hidden="true"
              >
                <ImageUpIcon className="size-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">
                  Drop or click to upload image
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  SVG, PNG, JPG, or WebP (max {maxSizeMB}MB)
                </p>
              </div>
            </div>
          )}
        </div>

        {previewUrl && !isLoading && !disabled && (
          <div className="absolute top-4 right-4">
            <button
              type="button"
              className="z-50 flex size-8 cursor-pointer items-center justify-center rounded-full bg-black/60 text-white transition-[color,box-shadow] outline-none hover:bg-black/80 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              onClick={(e) => {
                e.stopPropagation();
                removeImage();
              }}
              aria-label="Remove image"
            >
              <XIcon className="size-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      {error && (
        <div
          className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          <AlertCircleIcon className="size-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
