"use client";

import {
  AlertCircleIcon,
  ImageIcon,
  Loader2,
  UploadIcon,
  XIcon,
} from "lucide-react";
import { CldImage } from "next-cloudinary";
import React, { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  deleteImageFromCloudinary,
  uploadImageToCloudinary,
} from "@/actions/cloudinary";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getPublicIdFromUrl } from "@/utils/getPublicIdFromUrl";

interface AdditionalImagesUploaderProps {
  value?: string[];
  onChange?: (urls: string[]) => void;
  folder?: string;
  maxSizeMB?: number;
  maxFiles?: number;
  className?: string;
  disabled?: boolean;
  hideTitle?: boolean;
  compact?: boolean;
}

export default function AdditionalImagesUploader({
  value = [],
  onChange,
  folder = "products",
  maxSizeMB = 5,
  maxFiles = 6,
  className = "",
  disabled = false,
  hideTitle = false,
  compact = false,
}: AdditionalImagesUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>(value);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploadingCount, setUploadingCount] = useState(0);

  React.useEffect(() => {
    setImageUrls(value);
  }, [value]);

  const handleFileUpload = useCallback(
    async (files: File[]) => {
      setError(null);

      // Check max files limit
      if (imageUrls.length + files.length > maxFiles) {
        const errorMsg = `You can only upload a maximum of ${maxFiles} images.`;
        setError(errorMsg);
        toast.error(errorMsg);
        return;
      }

      const maxSize = maxSizeMB * 1024 * 1024;

      // Validate all files first
      for (const file of files) {
        if (file.size > maxSize) {
          const errorMsg = `File "${file.name}" is too large. Please upload files smaller than ${maxSizeMB}MB.`;
          setError(errorMsg);
          toast.error(errorMsg);
          return;
        }
      }
      setUploadingCount(files.length);

      startTransition(async () => {
        try {
          const uploadPromises = files.map(async (file) => {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("folder", folder);
            return await uploadImageToCloudinary(formData);
          });

          const results = await Promise.all(uploadPromises);

          const successfulUploads = results.filter((r) => r.success);
          const failedUploads = results.filter((r) => !r.success);

          if (successfulUploads.length > 0) {
            const newUrls = successfulUploads.map((r) => r.url);
            const updatedUrls = [...imageUrls, ...newUrls];
            setImageUrls(updatedUrls);
            onChange?.(updatedUrls);
            toast.success(
              `${successfulUploads.length} image(s) uploaded successfully!`,
            );
          }

          if (failedUploads.length > 0) {
            toast.error(`Failed to upload ${failedUploads.length} image(s)`);
          }
        } catch (error) {
          const errorMessage = "Failed to upload images. Please try again.";
          setError(errorMessage);
          toast.error(errorMessage);
          console.error("Upload error:", error);
        } finally {
          setUploadingCount(0);
        }
      });
    },
    [folder, maxSizeMB, maxFiles, imageUrls, onChange],
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

      const files = Array.from(e.dataTransfer.files).filter((file) =>
        file.type.startsWith("image/"),
      );

      if (files.length === 0) {
        toast.error("Please drop image files");
        return;
      }

      handleFileUpload(files);
    },
    [disabled, handleFileUpload],
  );

  const openFileDialog = useCallback(() => {
    if (disabled || isPending) return;

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/svg+xml,image/png,image/jpeg,image/jpg,image/webp";
    input.multiple = true;
    input.onchange = (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      if (files.length > 0) handleFileUpload(files);
    };
    input.click();
  }, [disabled, isPending, handleFileUpload]);

  const removeImage = useCallback(
    (urlToRemove: string) => {
      if (disabled) return;

      const publicId = getPublicIdFromUrl(urlToRemove);

      if (publicId) {
        setDeletingId(urlToRemove);
        startTransition(async () => {
          try {
            const result = await deleteImageFromCloudinary(publicId);

            if (result.success) {
              const updatedUrls = imageUrls.filter(
                (url) => url !== urlToRemove,
              );
              setImageUrls(updatedUrls);
              onChange?.(updatedUrls);
              setError(null);
              toast.success("Image deleted successfully");
            } else {
              toast.error(result.error || "Failed to delete image");
            }
          } catch (error) {
            console.error("Delete error:", error);
            toast.error("Failed to delete image");
          } finally {
            setDeletingId(null);
          }
        });
      } else {
        // Just remove from state if no public ID
        const updatedUrls = imageUrls.filter((url) => url !== urlToRemove);
        setImageUrls(updatedUrls);
        onChange?.(updatedUrls);
      }
    },
    [disabled, imageUrls, onChange],
  );

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {/* Drop area */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        data-dragging={isDragging || undefined}
        data-files={imageUrls.length > 0 || undefined}
        className={`relative flex flex-col items-center overflow-hidden rounded-xl border border-dashed border-input transition-colors not-data-[files]:justify-center data-[dragging=true]:bg-accent/50 ${compact ? "min-h-36 p-3" : "min-h-52 p-4"}`}
      >
        {imageUrls.length > 0 || uploadingCount > 0 ? (
          <div className="flex w-full flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              {!hideTitle && (
                <h3 className="truncate text-sm font-medium">
                  Additional Images ({imageUrls.length}/{maxFiles})
                </h3>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={openFileDialog}
                disabled={imageUrls.length >= maxFiles || disabled || isPending}
                className={hideTitle ? "ml-auto" : ""}
              >
                <UploadIcon
                  className="-ms-0.5 size-3.5 opacity-60"
                  aria-hidden="true"
                />
                Add more
              </Button>
            </div>

            <div
              className={
                compact
                  ? "flex flex-wrap gap-3 pt-1 pr-1"
                  : "grid grid-cols-2 gap-4 md:grid-cols-3 pt-2 pr-2"
              }
            >
              {imageUrls.map((url, index) => (
                <div
                  key={`${url}-${index}`}
                  className={`relative rounded-md bg-accent ${compact ? "w-20 h-20" : "aspect-square"}`}
                >
                  <CldImage
                    src={url}
                    alt={`Product image ${index + 1}`}
                    fill
                    className="object-cover rounded-md"
                    sizes="(max-width: 768px) 50vw, 33vw"
                  />
                  <Button
                    type="button"
                    onClick={() => removeImage(url)}
                    size="icon"
                    disabled={deletingId === url || disabled}
                    className={`absolute -top-1.5 -right-1.5 rounded-full border-2 border-background shadow-sm ${compact ? "size-5" : "size-6"}`}
                    aria-label="Remove image"
                  >
                    <XIcon className={compact ? "size-2.5" : "size-3.5"} />
                  </Button>
                </div>
              ))}
              {Array.from({ length: uploadingCount }).map((_, index) => (
                <div
                  key={`skeleton-${index}`}
                  className={`relative rounded-md bg-accent overflow-hidden ${compact ? "w-20 h-20" : "aspect-square"}`}
                >
                  <Skeleton className="h-full w-full" />
                  <div className="absolute inset-0 flex items-center justify-center bg-background/10">
                    <Loader2
                      className={`opacity-60 animate-spin ${compact ? "size-5" : "size-8"}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div
            className={`flex flex-col items-center justify-center text-center ${compact ? "px-3 py-2" : "px-4 py-3"}`}
          >
            <div
              className={`mb-2 flex shrink-0 items-center justify-center rounded-full border bg-background ${compact ? "size-9" : "size-11"}`}
              aria-hidden="true"
            >
              <ImageIcon
                className={compact ? "size-4 opacity-60" : "size-4 opacity-60"}
              />
            </div>
            <p
              className={
                compact
                  ? "mb-1 text-sm font-medium"
                  : "mb-1.5 text-sm font-medium"
              }
            >
              {compact ? "Drop images here" : "Drop your images here"}
            </p>
            {!compact && (
              <p className="text-xs text-muted-foreground">
                SVG, PNG, JPG or WEBP (max. {maxSizeMB}MB each, up to {maxFiles}{" "}
                images)
              </p>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={compact ? "mt-2 h-8" : "mt-4"}
              onClick={openFileDialog}
              disabled={disabled || isPending}
            >
              <UploadIcon className="-ms-1 opacity-60" aria-hidden="true" />
              {compact ? "Select images" : "Select images"}
            </Button>
          </div>
        )}
      </div>

      {error && (
        <div
          className="flex items-center gap-1 text-xs text-destructive"
          role="alert"
        >
          <AlertCircleIcon className="size-3 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
