"use client";

import { ExternalLink, Link2, UploadCloud, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import VideoUploader from "@/components/VideoUploader";
import { cn } from "@/lib/utils";

type VideoSource = "upload" | "link";

function isCloudinaryVideo(value: string) {
  try {
    const url = new URL(value);
    return (
      url.hostname === "res.cloudinary.com" &&
      url.pathname.includes("/video/upload/")
    );
  } catch {
    return false;
  }
}

function isPublicHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function sourceForValue(value: string): VideoSource {
  return value && !isCloudinaryVideo(value) ? "link" : "upload";
}

export function PropertyVideoField({
  value,
  onChange,
  disabled = false,
  invalid = false,
  allowLink = true,
}: {
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  allowLink?: boolean;
}) {
  const [source, setSource] = useState<VideoSource>(() =>
    sourceForValue(value),
  );
  const hasVideo = Boolean(value.trim());

  useEffect(() => {
    if (!allowLink) return;
    if (value) setSource(sourceForValue(value));
  }, [allowLink, value]);

  if (!allowLink) {
    return (
      <VideoUploader value={value} onChange={onChange} disabled={disabled} />
    );
  }

  return (
    <div className="space-y-3">
      <div
        className="inline-grid grid-cols-2 overflow-hidden rounded-md border border-gray-200 bg-white"
        role="group"
        aria-label="Building video source"
      >
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={disabled || (hasVideo && source !== "upload")}
          aria-pressed={source === "upload"}
          onClick={() => setSource("upload")}
          className={cn(
            "rounded-none border-r border-gray-200",
            source === "upload" &&
              "bg-emerald-600 text-white hover:bg-emerald-700 hover:text-white",
          )}
        >
          <UploadCloud /> Upload Video
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={disabled || (hasVideo && source !== "link")}
          aria-pressed={source === "link"}
          onClick={() => setSource("link")}
          className={cn(
            "rounded-none",
            source === "link" &&
              "bg-emerald-600 text-white hover:bg-emerald-700 hover:text-white",
          )}
        >
          <Link2 /> Add Video Link
        </Button>
      </div>

      {source === "upload" ? (
        <VideoUploader value={value} onChange={onChange} disabled={disabled} />
      ) : (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <Input
            id="property-video-link"
            type="url"
            value={value}
            disabled={disabled}
            aria-invalid={invalid}
            aria-label="Building video link"
            placeholder="https://youtube.com/... or a public video URL"
            onChange={(event) => onChange(event.target.value)}
            className="bg-white"
          />
          <p className="mt-2 text-xs text-gray-500">
            Paste a public YouTube, Facebook, Google Drive, or direct video
            link. Keep the video within 90 seconds.
          </p>

          {hasVideo ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {isPublicHttpUrl(value) ? (
                <Button size="sm" variant="outline" asChild>
                  <a href={value} target="_blank" rel="noreferrer">
                    <ExternalLink /> Open Video Link
                  </a>
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={disabled}
                onClick={() => onChange("")}
                className="text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                <X /> Remove Link
              </Button>
            </div>
          ) : null}
        </div>
      )}

      {hasVideo ? (
        <p className="text-xs text-gray-500">
          Remove the current video before switching to the other source.
        </p>
      ) : null}
    </div>
  );
}
