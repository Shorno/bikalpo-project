"use client";

import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

function formatShortDate(value?: string | Date | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-BD", {
    day: "numeric",
    month: "short",
  });
}

type FlowStep = {
  key: string;
  label: string;
  completed: boolean;
  date: string | Date | null;
};

type OrderFlowStepperProps = {
  steps: FlowStep[];
  variant?: "card" | "inline";
};

function StepConnector({ done }: { done: boolean }) {
  return (
    <div className="mt-[30px] flex-1 px-1">
      {done ? (
        <div className="h-0.5 w-full rounded bg-emerald-400" />
      ) : (
        <div className="h-0.5 w-full border-t-2 border-dashed border-gray-200" />
      )}
    </div>
  );
}

function StepNode({
  done,
  isCurrent,
}: {
  done: boolean;
  isCurrent: boolean;
}) {
  return (
    <div
      className={cn(
        "relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-all",
        done
          ? "border-emerald-500 bg-emerald-500 text-white"
          : isCurrent
            ? "border-blue-500 bg-blue-500 text-white"
            : "border-gray-200 bg-white text-gray-300",
      )}
    >
      {done ? (
        <CheckCircle2 className="h-3.5 w-3.5" />
      ) : isCurrent ? (
        <span className="h-2 w-2 rounded-full bg-white" />
      ) : (
        <span className="h-2 w-2 rounded-full bg-gray-200" />
      )}
      {isCurrent ? (
        <span className="absolute -inset-1 animate-ping rounded-full border-2 border-blue-400 opacity-25" />
      ) : null}
    </div>
  );
}

function InlineStepper({ steps }: { steps: FlowStep[] }) {
  const currentIdx = steps.findIndex((s) => !s.completed);

  return (
    <>
      <div className="hidden md:flex md:items-start">
        {steps.map((step, i) => {
          const done = step.completed;
          const isCurrent = i === currentIdx;
          const isLast = i === steps.length - 1;

          return (
            <div key={step.key} className="flex min-w-0 flex-1 items-start">
              <div className="flex min-w-0 flex-col items-center">
                <div className="mb-1.5 h-3.5 text-[10px] font-medium text-muted-foreground tabular-nums">
                  {step.date ? formatShortDate(step.date) : ""}
                </div>
                <StepNode done={done} isCurrent={isCurrent} />
                <div className="mt-2 max-w-[88px] text-center">
                  <div
                    className={cn(
                      "text-[11px] font-medium leading-tight",
                      done
                        ? "text-foreground"
                        : isCurrent
                          ? "text-blue-700"
                          : "text-muted-foreground",
                    )}
                  >
                    {step.label}
                  </div>
                </div>
              </div>
              {!isLast ? <StepConnector done={done} /> : null}
            </div>
          );
        })}
      </div>

      <div className="space-y-0 md:hidden">
        {steps.map((step, i) => {
          const done = step.completed;
          const isCurrent = i === currentIdx;
          const isLast = i === steps.length - 1;

          return (
            <div key={step.key} className="flex gap-3">
              <div className="flex flex-col items-center">
                <StepNode done={done} isCurrent={isCurrent} />
                {!isLast ? (
                  <div
                    className={cn(
                      "h-8 w-0.5",
                      done ? "bg-emerald-400" : "border-l-2 border-dashed border-gray-200",
                    )}
                  />
                ) : null}
              </div>
              <div className="pb-5 pt-1">
                <div
                  className={cn(
                    "text-sm font-medium",
                    done
                      ? "text-foreground"
                      : isCurrent
                        ? "text-blue-700"
                        : "text-muted-foreground",
                  )}
                >
                  {step.label}
                </div>
                {step.date ? (
                  <div className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                    {formatShortDate(step.date)}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function CardStepper({ steps }: { steps: FlowStep[] }) {
  const currentIdx = steps.findIndex((s) => !s.completed);
  const currentStep = currentIdx >= 0 ? steps[currentIdx] : steps[steps.length - 1];
  const allDone = steps.every((s) => s.completed);

  return (
    <>
      <div className="hidden md:block px-6 pt-6 pb-5">
        <div className="flex items-start">
          {steps.map((step, i) => {
            const done = step.completed;
            const isCurrent = i === currentIdx;
            const isLast = i === steps.length - 1;

            return (
              <div key={step.key} className="flex flex-1 items-start">
                <div className="flex min-w-0 flex-col items-center">
                  <div className="mb-2 h-4 text-[11px] font-medium text-muted-foreground tabular-nums">
                    {step.date ? formatShortDate(step.date) : ""}
                  </div>
                  <StepNode done={done} isCurrent={isCurrent} />
                  <div className="mt-2 max-w-[90px] text-center">
                    <div
                      className={cn(
                        "text-[11px] font-semibold leading-tight",
                        done
                          ? "text-gray-900"
                          : isCurrent
                            ? "text-blue-700"
                            : "text-gray-400",
                      )}
                    >
                      {step.label}
                    </div>
                  </div>
                </div>
                {!isLast ? <StepConnector done={done} /> : null}
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex justify-center">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold",
              allDone
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-blue-200 bg-blue-50 text-blue-700",
            )}
          >
            {allDone ? (
              <>
                <CheckCircle2 className="h-3 w-3" /> Completed
              </>
            ) : (
              <>Current Status: {currentStep?.label}</>
            )}
          </span>
        </div>
      </div>

      <div className="space-y-0 p-4 md:hidden">
        {steps.map((step, i) => {
          const done = step.completed;
          const isCurrent = i === currentIdx;
          const isLast = i === steps.length - 1;

          return (
            <div key={step.key} className="flex gap-3">
              <div className="flex flex-col items-center">
                <StepNode done={done} isCurrent={isCurrent} />
                {!isLast ? (
                  <div
                    className={cn(
                      "h-6 w-0.5",
                      done ? "bg-emerald-400" : "border-l-2 border-dashed border-gray-200",
                    )}
                  />
                ) : null}
              </div>
              <div className="pb-4">
                <div
                  className={cn(
                    "text-sm font-medium",
                    done
                      ? "text-gray-900"
                      : isCurrent
                        ? "text-blue-700"
                        : "text-gray-400",
                  )}
                >
                  {step.label}
                </div>
                <div className="text-xs text-muted-foreground">
                  {step.date
                    ? formatShortDate(step.date)
                    : isCurrent
                      ? "In progress"
                      : "—"}
                </div>
              </div>
            </div>
          );
        })}
      </div>
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
    <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b bg-gray-50/60 px-5 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Order Tracker
        </h2>
      </div>
      <CardStepper steps={steps} />
    </div>
  );
}
