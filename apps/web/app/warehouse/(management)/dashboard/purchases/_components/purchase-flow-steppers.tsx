"use client";

import { cn } from "@/lib/utils";

type FlowStep = {
  key: string;
  label: string;
  date?: string | Date | null;
  state: "done" | "current" | "upcoming";
  subtitle?: string | null;
};

function formatShortDate(value?: string | Date | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-BD", {
    day: "numeric",
    month: "short",
  });
}

function StepNode({ state }: { state: "done" | "current" | "upcoming" }) {
  return (
    <div
      className={cn(
        "relative z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 bg-card transition-colors",
        state === "done"
          ? "border-emerald-500 bg-emerald-500"
          : state === "current"
            ? "border-amber-500 bg-amber-500"
            : "border-border",
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          state === "upcoming" ? "bg-muted-foreground/30" : "bg-white",
        )}
      />
    </div>
  );
}

/** Dot row offset: date row (h-3.5 + mb-1) + half of node (h-5) */
const CONNECTOR_TOP = "top-[1.875rem]";

export function ShipmentFlowStepper({ steps }: { steps: FlowStep[] }) {
  return (
    <>
      <div className="relative hidden w-full md:flex">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          const connectorDone = step.state === "done";

          return (
            <div
              key={step.key}
              className="relative flex min-w-0 flex-1 flex-col items-center"
            >
              {!isLast ? (
                <div
                  className={cn(
                    "pointer-events-none absolute left-1/2 z-0 h-0.5 w-full -translate-y-1/2",
                    CONNECTOR_TOP,
                  )}
                  aria-hidden
                >
                  {connectorDone ? (
                    <div className="h-full bg-emerald-300" />
                  ) : (
                    <div className="h-0 border-t border-dashed border-border" />
                  )}
                </div>
              ) : null}

              <div className="relative z-10 flex w-full flex-col items-center px-0.5">
                <div className="mb-1 flex h-4 w-full items-center justify-center text-xs leading-none text-muted-foreground tabular-nums">
                  {formatShortDate(step.date) ?? "\u00a0"}
                </div>
                <StepNode state={step.state} />
                <p
                  className={cn(
                    "mt-1.5 w-full text-center text-xs font-medium leading-snug",
                    step.state === "done"
                      ? "text-foreground"
                      : step.state === "current"
                        ? "text-amber-700"
                        : "text-muted-foreground",
                  )}
                >
                  {step.label}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="space-y-0 md:hidden">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          return (
            <div key={step.key} className="flex gap-2.5">
              <div className="flex flex-col items-center">
                <StepNode state={step.state} />
                {!isLast ? (
                  <div
                    className={cn(
                      "h-6 w-px",
                      step.state === "done" ? "bg-emerald-300" : "bg-border",
                    )}
                  />
                ) : null}
              </div>
              <div className="pb-3 pt-0.5">
                <p
                  className={cn(
                    "text-xs font-medium",
                    step.state === "done"
                      ? "text-foreground"
                      : step.state === "current"
                        ? "text-amber-700"
                        : "text-muted-foreground",
                  )}
                >
                  {step.label}
                </p>
                {step.date ? (
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {formatShortDate(step.date)}
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

export function OrderTimeline({ steps }: { steps: FlowStep[] }) {
  return (
    <div className="space-y-0">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        return (
          <div key={step.key} className="flex gap-3">
            <div className="flex flex-col items-center">
              <StepNode state={step.state} />
              {!isLast ? (
                <div
                  className={cn(
                    "mt-1 w-px flex-1 min-h-4",
                    step.state === "done" ? "bg-emerald-300" : "bg-border",
                  )}
                />
              ) : null}
            </div>
            <div className="pb-4 min-w-0">
              <p
                className={cn(
                  "text-sm font-medium",
                  step.state === "done"
                    ? "text-foreground"
                    : step.state === "current"
                      ? "text-amber-700"
                      : "text-muted-foreground",
                )}
              >
                {step.label}
              </p>
              <p className="text-xs text-muted-foreground tabular-nums">
                {step.date
                  ? new Date(step.date).toLocaleDateString("en-BD", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : step.state === "current"
                    ? "In progress"
                    : step.state === "upcoming"
                      ? "Upcoming"
                      : ""}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
