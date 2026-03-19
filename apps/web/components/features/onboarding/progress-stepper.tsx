"use client";

interface ProgressStepperProps {
  currentStep: number;
  totalSteps: number;
  onStepClick: (step: number) => void;
  completedSteps: number[];
}

const STEP_LABELS = [
  "Account",
  "Business",
  "Location",
  "Documents",
  "Plan",
];

const STEP_ICONS = [
  "person",
  "storefront",
  "location_on",
  "description",
  "workspace_premium",
];

export function ProgressStepper({
  currentStep,
  totalSteps,
  onStepClick,
  completedSteps,
}: ProgressStepperProps) {
  return (
    <div className="w-full max-w-3xl mx-auto mb-10">
      <div className="flex items-center justify-between relative">
        {/* Progress line */}
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200 z-0" />
        <div
          className="absolute top-5 left-0 h-0.5 bg-[#003178] z-0 transition-all duration-500"
          style={{
            width: `${((Math.max(0, currentStep - 1)) / (totalSteps - 1)) * 100}%`,
          }}
        />

        {Array.from({ length: totalSteps }, (_, i) => {
          const step = i + 1;
          const isCompleted = completedSteps.includes(step);
          const isCurrent = currentStep === step;
          const isClickable = isCompleted || step <= Math.max(...completedSteps, 0) + 1;

          return (
            <button
              key={step}
              onClick={() => isClickable && onStepClick(step)}
              disabled={!isClickable}
              className={`
                relative z-10 flex flex-col items-center gap-2 group
                ${isClickable ? "cursor-pointer" : "cursor-not-allowed"}
              `}
            >
              {/* Circle */}
              <div
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center
                  transition-all duration-300 text-sm font-bold
                  ${
                    isCompleted
                      ? "bg-[#003178] text-white shadow-lg shadow-[#003178]/20"
                      : isCurrent
                        ? "bg-[#003178] text-white shadow-lg shadow-[#003178]/30 ring-4 ring-[#003178]/10"
                        : "bg-white text-gray-400 border-2 border-gray-200"
                  }
                  ${isClickable && !isCurrent ? "group-hover:scale-110" : ""}
                `}
              >
                {isCompleted ? (
                  <span
                    className="material-symbols-outlined text-lg"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    check
                  </span>
                ) : (
                  <span
                    className="material-symbols-outlined text-lg"
                    style={{
                      fontVariationSettings: isCurrent ? "'FILL' 1" : "'FILL' 0",
                    }}
                  >
                    {STEP_ICONS[i]}
                  </span>
                )}
              </div>

              {/* Label */}
              <span
                className={`
                  text-xs font-semibold tracking-wide hidden sm:block
                  transition-colors duration-300
                  ${
                    isCurrent
                      ? "text-[#003178]"
                      : isCompleted
                        ? "text-[#003178]/70"
                        : "text-gray-400"
                  }
                `}
              >
                {STEP_LABELS[i]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
