"use client";

import { AlertCircle, Loader2, UploadCloud, Video, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getPublicIdFromUrl } from "@/utils/getPublicIdFromUrl";
import { client } from "@/utils/orpc";

const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const MAX_VIDEO_SECONDS = 90;
const ALLOWED_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

interface VideoUploaderProps {
  value?: string;
  onChange: (url: string) => void;
  disabled?: boolean;
  subjectLabel?: string;
}

interface DirectUploadResult {
  public_id?: string;
  secure_url?: string;
  error?: { message?: string };
}

function videoDuration(file: File) {
  return new Promise<number>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      video.load();
    };

    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const duration = video.duration;
      cleanup();
      if (Number.isFinite(duration)) resolve(duration);
      else reject(new Error("Could not read video duration"));
    };
    video.onerror = () => {
      cleanup();
      reject(new Error("Could not read video metadata"));
    };
    video.src = url;
  });
}

function uploadToCloudinary(
  file: File,
  credentials: {
    cloudName: string;
    apiKey: string;
    folder: string;
    timestamp: number;
    signature: string;
  },
  onProgress: (progress: number) => void,
) {
  return new Promise<DirectUploadResult>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open(
      "POST",
      `https://api.cloudinary.com/v1_1/${credentials.cloudName}/video/upload`,
    );
    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onerror = () => reject(new Error("Video upload failed"));
    request.onload = () => {
      let result: DirectUploadResult;
      try {
        result = JSON.parse(request.responseText) as DirectUploadResult;
      } catch {
        reject(new Error("Cloudinary returned an invalid response"));
        return;
      }
      if (request.status >= 200 && request.status < 300) resolve(result);
      else reject(new Error(result.error?.message || "Video upload failed"));
    };

    const form = new FormData();
    form.append("file", file);
    form.append("api_key", credentials.apiKey);
    form.append("folder", credentials.folder);
    form.append("timestamp", String(credentials.timestamp));
    form.append("signature", credentials.signature);
    request.send(form);
  });
}

export default function VideoUploader({
  value = "",
  onChange,
  disabled = false,
  subjectLabel = "Building video",
}: VideoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  const handleFile = useCallback(
    async (file: File) => {
      setError("");
      if (!ALLOWED_VIDEO_TYPES.has(file.type)) {
        const message = "Upload an MP4, WebM or MOV video.";
        setError(message);
        toast.error(message);
        return;
      }
      if (file.size > MAX_VIDEO_BYTES) {
        const message = "Video must be smaller than 100MB.";
        setError(message);
        toast.error(message);
        return;
      }

      setIsUploading(true);
      setProgress(0);
      try {
        const duration = await videoDuration(file);
        if (duration > MAX_VIDEO_SECONDS) {
          throw new Error("Video must be 90 seconds or shorter.");
        }

        const credentials = await client.cloudinary.createVideoUploadSignature(
          {},
        );
        const uploaded = await uploadToCloudinary(
          file,
          credentials,
          setProgress,
        );
        if (!uploaded.public_id) {
          throw new Error("Cloudinary did not return a video identity.");
        }

        const finalized = await client.cloudinary.finalizeVideoUpload({
          publicId: uploaded.public_id,
        });
        if (!finalized.success) throw new Error(finalized.error);

        const previousPublicId = value ? getPublicIdFromUrl(value) : null;
        onChange(finalized.url);
        toast.success(`${subjectLabel} uploaded successfully`);

        if (previousPublicId && previousPublicId !== uploaded.public_id) {
          void client.cloudinary.delete({
            publicId: previousPublicId,
            resourceType: "video",
          });
        }
      } catch (uploadError) {
        const message =
          uploadError instanceof Error
            ? uploadError.message
            : "Could not upload the video.";
        setError(message);
        toast.error(message);
      } finally {
        setIsUploading(false);
        setProgress(0);
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [onChange, subjectLabel, value],
  );

  const removeVideo = useCallback(async () => {
    if (!value || disabled || isUploading) return;
    setIsDeleting(true);
    try {
      const publicId = getPublicIdFromUrl(value);
      if (publicId) {
        const result = await client.cloudinary.delete({
          publicId,
          resourceType: "video",
        });
        if (!result.success) throw new Error(result.message);
      }
      onChange("");
      setError("");
      toast.success(`${subjectLabel} removed`);
    } catch (deleteError) {
      toast.error(
        deleteError instanceof Error
          ? deleteError.message
          : "Could not remove the video.",
      );
    } finally {
      setIsDeleting(false);
    }
  }, [disabled, isUploading, onChange, subjectLabel, value]);

  const busy = isUploading || isDeleting;

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime"
        className="sr-only"
        disabled={disabled || busy}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />

      <div
        role="button"
        tabIndex={disabled || busy ? -1 : 0}
        aria-label={
          value ? `Replace ${subjectLabel}` : `Upload ${subjectLabel}`
        }
        aria-disabled={disabled || busy}
        onClick={() => !disabled && !busy && inputRef.current?.click()}
        onKeyDown={(event) => {
          if (
            (event.key === "Enter" || event.key === " ") &&
            !disabled &&
            !busy
          ) {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragEnter={(event) => {
          event.preventDefault();
          if (!disabled && !busy) setIsDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          event.preventDefault();
          setIsDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          if (disabled || busy) return;
          const file = event.dataTransfer.files[0];
          if (file) void handleFile(file);
        }}
        className={cn(
          "relative flex min-h-44 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-input bg-white p-4 transition",
          !disabled &&
            !busy &&
            "cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/30",
          isDragging && "scale-[0.99] border-emerald-500 bg-emerald-50",
          (disabled || busy) && "cursor-not-allowed opacity-70",
          value && "border-solid",
        )}
      >
        {busy ? (
          <div className="text-center">
            <Loader2 className="mx-auto size-9 animate-spin text-emerald-600" />
            <p className="mt-3 text-sm font-medium text-gray-900">
              {isDeleting
                ? "Removing video..."
                : `Uploading video ${progress}%`}
            </p>
            {isUploading ? (
              <div className="mx-auto mt-2 h-1.5 w-48 overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full rounded-full bg-emerald-600 transition-[width]"
                  style={{ width: `${progress}%` }}
                />
              </div>
            ) : null}
          </div>
        ) : value ? (
          <video
            src={value}
            controls
            preload="metadata"
            className="max-h-72 w-full rounded-lg bg-black object-contain"
            onClick={(event) => event.stopPropagation()}
          >
            <track kind="captions" />
          </video>
        ) : (
          <div className="text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-full border bg-white shadow-sm">
              <UploadCloud className="size-5 text-gray-500" />
            </span>
            <p className="mt-3 text-sm font-medium text-gray-900">
              Drop or click to upload video
            </p>
            <p className="mt-1 text-xs text-gray-500">
              MP4, WebM or MOV · maximum 90 seconds · maximum 100MB
            </p>
          </div>
        )}

        {value && !busy && !disabled ? (
          <Button
            type="button"
            size="icon"
            variant="secondary"
            aria-label="Remove building video"
            className="absolute right-3 top-3 rounded-full bg-black/70 text-white hover:bg-black"
            onClick={(event) => {
              event.stopPropagation();
              void removeVideo();
            }}
          >
            <X className="size-4" />
          </Button>
        ) : null}
      </div>

      {value ? (
        <div className="flex items-center gap-2 text-xs text-emerald-700">
          <Video className="size-4" /> {subjectLabel} added
        </div>
      ) : null}
      {error ? (
        <div
          className="flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700"
          role="alert"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" /> {error}
        </div>
      ) : null}
    </div>
  );
}
