import type { StepItem } from "./StepIndicator";

export type AssessmentStepId = "upload" | "details";

export const ASSESSMENT_STEPS: StepItem<AssessmentStepId>[] = [
  { id: "upload", label: "Upload" },
  { id: "details", label: "Review your details" },
];
