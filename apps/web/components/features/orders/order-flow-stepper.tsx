"use client";

import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type OrderFlowStep = {
  key: string;
  label: string;
  completed: boolean;
  date: string | Date | null;
  tone?: "default" | "warning" | "danger";
};

type OrderFlowStepperProps = {
  steps: OrderFlowStep[];
  variant?: "card" | "inline";
};

function formatShortDate(value?: string | Date | null) {
  if (!value) return null;

  return new Date(value).toLocaleDateString("en-BD", {
    day: "numeric",
    month: "short",
  });
}

function getCurrentIndex(steps: OrderFlowStep[]) {
  const firstIncomplete = steps.findIndex((step) => !step.completed);
  return firstIncomplete >= 0 ? firstIncomplete : steps.length - 1;
}

function StepConnector({
  completed,
  tone,
}: {
  completed: boolean;
  tone?: OrderFlowStep["tone"];
}) {
  return (
    <div className="mt-[30px] flex-1 px-1" aria-hidden="true">
      <div
        className={cn(
          "h-0.5 w-full",
          completed
            ? tone === "danger"
              ? "bg-red-300"
              : tone === "warning"
                ? "bg-amber-300"
                : "bg-emerald-400"
            : "border-t-2 border-dashed border-zinc-200",
        )}
      />
    </div>
  );
}

function StepNode({
  completed,
  current,
  tone,
}: {
  completed: boolean;
  current: boolean;
  tone?: OrderFlowStep["tone"];
}) {
  const Icon =
    tone === "danger"
      ? XCircle
      : tone === "warning"
        ? AlertTriangle
        : CheckCircle2;

  return (
    <div
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2",
        completed
          ? tone === "danger"
            ? "border-red-500 bg-red-500 text-white"
            : tone === "warning"
              ? "border-amber-500 bg-amber-500 text-white"
              : "border-emerald-500 bg-emerald-500 text-white"
          : current
            ? tone === "danger"
              ? "border-red-500 bg-red-500 text-white"
              : tone === "warning"
                ? "border-amber-500 bg-amber-500 text-white"
                : "border-blue-600 bg-blue-600 text-white"
            : "border-zinc-200 bg-white text-zinc-300",
      )}
      aria-hidden="true"
    >
      {completed || (current && tone && tone !== "default") ? (
        <Icon className="h-3.5 w-3.5" />
      ) : current ? (
        <span className="h-2 w-2 rounded-full bg-white" />
      ) : (
        <span className="h-2 w-2 rounded-full bg-zinc-200" />
      )}
    </div>
  );
}

function InlineStepper({ steps }: { steps: OrderFlowStep[] }) {
  const currentIndex = getCurrentIndex(steps);

  return (
    <>
      <ol className="hidden items-start md:flex" aria-label="Order progress">
        {steps.map((step, index) => {
          const current = index === currentIndex;
          const last = index === steps.length - 1;

          return (
            <li key={step.key} className="flex min-w-0 flex-1 items-start">
              <div className="flex min-w-0 flex-col items-center">
                <time className="mb-1.5 h-3.5 text-[10px] font-medium tabular-nums text-muted-foreground">
                  {step.date ? formatShortDate(step.date) : ""}
                </time>
                <StepNode
                  completed={step.completed}
                  current={current}
                  tone={step.tone}
                />
                <span
                  className={cn(
                    "mt-2 max-w-24 text-center text-[11px] font-medium leading-tight",
                    step.completed
                      ? step.tone === "danger"
                        ? "text-red-700"
                        : step.tone === "warning"
                          ? "text-amber-700"
                          : "text-foreground"
                      : current
                        ? step.tone === "danger"
                          ? "text-red-700"
                          : step.tone === "warning"
                            ? "text-amber-700"
                            : "text-blue-700"
                        : "text-muted-foreground",
                  )}
                  aria-current={current ? "step" : undefined}
                >
                  {step.label}
                </span>
              </div>
              {!last && (
                <StepConnector completed={step.completed} tone={step.tone} />
              )}
            </li>
          );
        })}
      </ol>

      <ol className="space-y-0 md:hidden" aria-label="Order progress">
        {steps.map((step, index) => {
          const current = index === currentIndex;
          const last = index === steps.length - 1;

          return (
            <li key={step.key} className="flex gap-3">
              <div className="flex flex-col items-center">
                <StepNode
                  completed={step.completed}
                  current={current}
                  tone={step.tone}
                />
                {!last && (
                  <div
                    className={cn(
                      "h-8 w-0.5",
                      step.completed
                        ? step.tone === "danger"
                          ? "bg-red-300"
                          : step.tone === "warning"
                            ? "bg-amber-300"
                            : "bg-emerald-400"
                        : "border-l-2 border-dashed border-zinc-200",
                    )}
                    aria-hidden="true"
                  />
                )}
              </div>
              <div className="pb-5 pt-1">
                <p
                  className={cn(
                    "text-sm font-medium",
                    step.completed
                      ? step.tone === "danger"
                        ? "text-red-700"
                        : step.tone === "warning"
                          ? "text-amber-700"
                          : "text-foreground"
                      : current
                        ? step.tone === "danger"
                          ? "text-red-700"
                          : step.tone === "warning"
                            ? "text-amber-700"
                            : "text-blue-700"
                        : "text-muted-foreground",
                  )}
                  aria-current={current ? "step" : undefined}
                >
                  {step.label}
                </p>
                <time className="mt-0.5 block text-xs tabular-nums text-muted-foreground">
                  {step.date
                    ? formatShortDate(step.date)
                    : current
                      ? "In progress"
                      : "Not started"}
                </time>
              </div>
            </li>
          );
        })}
      </ol>
    </>
  );
}

export function OrderFlowStepper({
  steps,
  variant = "card",
}: OrderFlowStepperProps) {
  if (variant === "inline") {
    return (
      <div className="py-1">
        <InlineStepper steps={steps} />
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-lg border bg-card">
      <header className="border-b bg-zinc-50/70 px-5 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Order progress
        </h2>
      </header>
      <div className="p-5">
        <InlineStepper steps={steps} />
      </div>
    </section>
  );
}
