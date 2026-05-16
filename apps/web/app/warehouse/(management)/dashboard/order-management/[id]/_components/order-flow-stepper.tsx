"use client";

import { CheckCircle2, Truck } from "lucide-react";

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

export function OrderFlowStepper({ steps }: { steps: FlowStep[] }) {
  const currentIdx = steps.findIndex((s) => !s.completed);
  const currentStep = currentIdx >= 0 ? steps[currentIdx] : steps[steps.length - 1];
  const allDone = steps.every((s) => s.completed);

  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 border-b bg-gray-50/60 px-5 py-3">
        <Truck className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Order Tracker
        </h2>
      </div>

      {/* Desktop */}
      <div className="hidden md:block px-6 pt-6 pb-5">
        <div className="flex items-start">
          {steps.map((step, i) => {
            const done = step.completed;
            const isCurrent = i === currentIdx;
            const isLast = i === steps.length - 1;

            return (
              <div key={step.key} className="flex flex-1 items-start">
                <div className="flex flex-col items-center min-w-0">
                  {/* Date */}
                  <div className="mb-2 text-[11px] font-medium text-muted-foreground tabular-nums h-4">
                    {step.date ? formatShortDate(step.date) : ""}
                  </div>
                  {/* Circle */}
                  <div
                    className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                      done
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : isCurrent
                          ? "border-blue-500 bg-blue-500 text-white"
                          : "border-gray-200 bg-white text-gray-300"
                    }`}
                  >
                    {done ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : isCurrent ? (
                      <span className="h-2 w-2 rounded-full bg-white" />
                    ) : (
                      <span className="h-2 w-2 rounded-full bg-gray-200" />
                    )}
                    {isCurrent && (
                      <span className="absolute -inset-1 animate-ping rounded-full border-2 border-blue-400 opacity-25" />
                    )}
                  </div>
                  {/* Label */}
                  <div className="mt-2 text-center max-w-[90px]">
                    <div
                      className={`text-[11px] font-semibold leading-tight ${
                        done
                          ? "text-gray-900"
                          : isCurrent
                            ? "text-blue-700"
                            : "text-gray-400"
                      }`}
                    >
                      {step.label}
                    </div>
                  </div>
                </div>

                {/* Connector */}
                {!isLast && (
                  <div className="mt-[38px] flex-1 px-1">
                    {done ? (
                      <div className="h-0.5 w-full bg-emerald-400 rounded" />
                    ) : (
                      <div className="h-0.5 w-full border-t-2 border-dashed border-gray-200" />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Current status */}
        <div className="mt-4 flex justify-center">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
            allDone
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-blue-50 text-blue-700 border border-blue-200"
          }`}>
            {allDone ? (
              <><CheckCircle2 className="h-3 w-3" /> Completed</>
            ) : (
              <>Current Status: {currentStep?.label}</>
            )}
          </span>
        </div>
      </div>

      {/* Mobile vertical */}
      <div className="p-4 md:hidden space-y-0">
        {steps.map((step, i) => {
          const done = step.completed;
          const isCurrent = i === currentIdx;
          const isLast = i === steps.length - 1;

          return (
            <div key={step.key} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full border-2 ${
                    done
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : isCurrent
                        ? "border-blue-500 bg-blue-500 text-white"
                        : "border-gray-200 bg-white text-gray-300"
                  }`}
                >
                  {done ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  )}
                </div>
                {!isLast && (
                  <div className={`h-6 w-0.5 ${done ? "bg-emerald-400" : "border-l-2 border-dashed border-gray-200"}`} />
                )}
              </div>
              <div className="pb-4">
                <div className={`text-sm font-medium ${done ? "text-gray-900" : isCurrent ? "text-blue-700" : "text-gray-400"}`}>
                  {step.label}
                </div>
                <div className="text-xs text-muted-foreground">
                  {step.date ? formatShortDate(step.date) : isCurrent ? "In progress" : "—"}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
