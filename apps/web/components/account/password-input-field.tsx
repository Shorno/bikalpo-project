"use client";

import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PasswordInputField({
  autoComplete,
  disabled = false,
  error,
  hint,
  id,
  label,
  onChange,
  onToggleVisibility,
  value,
  visible,
}: {
  autoComplete: "current-password" | "new-password";
  disabled?: boolean;
  error?: string;
  hint?: string;
  id: string;
  label: string;
  onChange: (value: string) => void;
  onToggleVisibility: () => void;
  value: string;
  visible: boolean;
}) {
  const descriptionId = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          minLength={autoComplete === "new-password" ? 8 : undefined}
          maxLength={128}
          aria-invalid={Boolean(error)}
          aria-describedby={descriptionId}
          disabled={disabled}
          className="h-11 pr-11 text-base sm:text-sm"
          required
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onToggleVisibility}
          disabled={disabled}
          className="absolute top-1/2 right-2 -translate-y-1/2 text-gray-500"
          aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}
          aria-pressed={visible}
        >
          {visible ? (
            <EyeOff className="size-4" aria-hidden="true" />
          ) : (
            <Eye className="size-4" aria-hidden="true" />
          )}
        </Button>
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs leading-5 text-gray-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
