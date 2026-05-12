"use client";

import { CheckCircle2, Circle } from "lucide-react";

function formatDate(value?: string | Date | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-BD", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

type FlowStep = {
  key: string;
  label: string;
  completed: boolean;
  date: string | Date | null;
};

export function OrderFlowStepper({ steps }: { steps: FlowStep[] }) {
  const currentIdx = steps.findIndex((s) => !s.completed);

  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <h2 className="mb-5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Delivery Assignment Flow
      </h2>

      {/* Desktop horizontal */}
      <div className="hidden items-start md:flex">
        {steps.map((step, i) => {
          const isCompleted = step.completed;
          const isCurrent = i === currentIdx;
          const isLast = i === steps.length - 1;

          return (
            <div key={step.key} className="flex flex-1 items-start">
              <div className="flex flex-col items-center">
                {/* Circle */}
                <div
                  className={`relative flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all ${
                    isCompleted
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : isCurrent
                        ? "border-blue-500 bg-blue-50 text-blue-600"
                        : "border-gray-200 bg-gray-50 text-gray-400"
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-4.5 w-4.5" />
                  ) : (
                    <span className="text-xs font-bold">{i + 1}</span>
                  )}
                  {isCurrent && (
                    <span className="absolute -inset-1 animate-ping rounded-full border-2 border-blue-400 opacity-30" />
                  )}
                </div>

                {/* Label + date */}
                <div className="mt-2.5 text-center">
                  <div
                    className={`text-xs font-semibold leading-tight ${
                      isCompleted
                        ? "text-gray-900"
                        : isCurrent
                          ? "text-blue-700"
                          : "text-gray-400"
                    }`}
                  >
                    {step.label}
                  </div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">
                    {isCompleted && step.date
                      ? formatDate(step.date)
                      : isCurrent
                        ? "In progress"
                        : "—"}
                  </div>
                </div>
              </div>

              {/* Connector line */}
              {!isLast && (
                <div className="mt-4 flex-1 px-1">
                  <div
                    className={`h-0.5 w-full rounded ${
                      isCompleted ? "bg-emerald-400" : "bg-gray-200"
                    }`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile vertical */}
      <div className="space-y-0 md:hidden">
        {steps.map((step, i) => {
          const isCompleted = step.completed;
          const isCurrent = i === currentIdx;
          const isLast = i === steps.length - 1;

          return (
            <div key={step.key} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full border-2 ${
                    isCompleted
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : isCurrent
                        ? "border-blue-500 bg-blue-50 text-blue-600"
                        : "border-gray-200 bg-gray-50 text-gray-400"
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <span className="text-[10px] font-bold">{i + 1}</span>
                  )}
                </div>
                {!isLast && (
                  <div
                    className={`h-6 w-0.5 ${isCompleted ? "bg-emerald-400" : "bg-gray-200"}`}
                  />
                )}
              </div>
              <div className="pb-5">
                <div
                  className={`text-sm font-medium ${
                    isCompleted
                      ? "text-gray-900"
                      : isCurrent
                        ? "text-blue-700"
                        : "text-gray-400"
                  }`}
                >
                  {step.label}
                </div>
                <div className="text-xs text-muted-foreground">
                  {isCompleted && step.date
                    ? formatDate(step.date)
                    : isCurrent
                      ? "In progress"
                      : "—"}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
