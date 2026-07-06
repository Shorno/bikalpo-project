"use client";

import { RegistrationStepNav } from "./registration-primitives";

interface ProgressStepperProps {
  currentStep: number;
  totalSteps: number;
  onStepClick: (step: number) => void;
  completedSteps: number[];
}

/** @deprecated Use RegistrationStepNav from registration-primitives */
export function ProgressStepper({
  currentStep,
  onStepClick,
  completedSteps,
}: ProgressStepperProps) {
  return (
    <RegistrationStepNav
      currentStep={currentStep}
      completedSteps={completedSteps}
      onStepClick={onStepClick}
      orientation="horizontal"
    />
  );
}
