"use client";

import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const REGISTRATION_STEPS = [
  { id: 1, label: "Basic information" },
  { id: 2, label: "Business details" },
  { id: 3, label: "Verification" },
  { id: 4, label: "Review" },
] as const;

export function RegistrationPageHeader({
  title,
  description,
  className,
}: {
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Seller application
      </p>
      <h1 className="text-xl font-semibold text-foreground sm:text-2xl">{title}</h1>
      {description ? (
        <p className="text-sm text-muted-foreground max-w-prose">{description}</p>
      ) : null}
    </div>
  );
}

export function RegistrationStepNav({
  currentStep,
  completedSteps,
  onStepClick,
  orientation = "vertical",
}: {
  currentStep: number;
  completedSteps: number[];
  onStepClick: (step: number) => void;
  orientation?: "vertical" | "horizontal";
}) {
  const maxCompleted = Math.max(...completedSteps, 0);

  if (orientation === "horizontal") {
    return (
      <nav aria-label="Registration progress" className="lg:hidden">
        <ol className="flex items-center gap-2">
          {REGISTRATION_STEPS.map((step, index) => {
            const isCompleted = completedSteps.includes(step.id);
            const isCurrent = currentStep === step.id;
            const isClickable = isCompleted || step.id <= maxCompleted + 1;

            return (
              <li key={step.id} className="flex flex-1 items-center gap-2">
                <button
                  type="button"
                  onClick={() => isClickable && onStepClick(step.id)}
                  disabled={!isClickable}
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-medium transition-colors",
                    isCompleted
                      ? "border-primary bg-primary text-primary-foreground"
                      : isCurrent
                        ? "border-primary text-primary"
                        : "border-border text-muted-foreground",
                    !isClickable && "cursor-not-allowed opacity-50",
                  )}
                  aria-current={isCurrent ? "step" : undefined}
                >
                  {isCompleted ? <Check className="h-4 w-4" /> : step.id}
                </button>
                {index < REGISTRATION_STEPS.length - 1 ? (
                  <div
                    className={cn(
                      "h-px flex-1",
                      isCompleted ? "bg-primary" : "bg-border",
                    )}
                  />
                ) : null}
              </li>
            );
          })}
        </ol>
      </nav>
    );
  }

  return (
    <nav aria-label="Registration progress" className="hidden lg:block">
      <ol className="space-y-1">
        {REGISTRATION_STEPS.map((step) => {
          const isCompleted = completedSteps.includes(step.id);
          const isCurrent = currentStep === step.id;
          const isClickable = isCompleted || step.id <= maxCompleted + 1;

          return (
            <li key={step.id}>
              <button
                type="button"
                onClick={() => isClickable && onStepClick(step.id)}
                disabled={!isClickable}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                  isCurrent
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  !isClickable && "cursor-not-allowed opacity-50",
                )}
                aria-current={isCurrent ? "step" : undefined}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium",
                    isCompleted
                      ? "border-primary bg-primary text-primary-foreground"
                      : isCurrent
                        ? "border-primary text-primary"
                        : "border-border",
                  )}
                >
                  {isCompleted ? <Check className="h-3.5 w-3.5" /> : step.id}
                </span>
                <span className="font-medium">{step.label}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="mt-6 text-xs text-muted-foreground leading-relaxed">
        Takes about 5 minutes. You can save progress by completing each step.
      </p>
      <Link
        href="/b2b/contact"
        className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
      >
        Need help?
      </Link>
    </nav>
  );
}

export function RegistrationSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("border-b border-border pb-6 mb-6 last:mb-0 last:border-0 last:pb-0", className)}>
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function RegistrationActions({
  onBack,
  onPrimary,
  primaryLabel,
  primaryDisabled,
  showBack = true,
  primaryType = "button",
}: {
  onBack?: () => void;
  onPrimary?: () => void;
  primaryLabel: string;
  primaryDisabled?: boolean;
  showBack?: boolean;
  primaryType?: "button" | "submit";
}) {
  return (
    <div className="sticky bottom-0 z-10 -mx-6 -mb-6 mt-8 border-t border-border bg-card px-6 py-4 sm:static sm:mx-0 sm:mb-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
      <div className="flex gap-3">
        {showBack && onBack ? (
          <Button type="button" variant="outline" size="lg" onClick={onBack} className="min-h-11">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        ) : null}
        <Button
          type={primaryType}
          size="lg"
          className="min-h-11 flex-1"
          disabled={primaryDisabled}
          onClick={primaryType === "button" ? onPrimary : undefined}
        >
          {primaryLabel}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function RegistrationFieldLabel({
  children,
  required,
  optional,
  htmlFor,
}: {
  children: React.ReactNode;
  required?: boolean;
  optional?: boolean;
  htmlFor?: string;
}) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
      {children}
      {required ? <span className="text-destructive"> *</span> : null}
      {optional ? (
        <span className="font-normal text-muted-foreground"> (optional)</span>
      ) : null}
    </label>
  );
}

export function RegistrationReviewRow({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-1 gap-1 border-b border-border py-3 text-sm last:border-0 sm:grid-cols-[minmax(0,11rem)_1fr] sm:gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  );
}

export function RegistrationChecklistItem({
  label,
  done,
}: {
  label: string;
  done: boolean;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded-full border",
          done
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border text-transparent",
        )}
        aria-hidden
      >
        <Check className="h-3 w-3" />
      </span>
      <span className={done ? "text-foreground" : "text-muted-foreground"}>
        {label}
      </span>
    </div>
  );
}
