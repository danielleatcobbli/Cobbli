import type { StepItem } from "./StepIndicator";

export type AssessmentStepId = "upload" | "details" | "deposit";

export const ASSESSMENT_STEPS: StepItem<AssessmentStepId>[] = [
  { id: "upload", label: "Upload" },
  { id: "details", label: "Review your details" },
  { id: "deposit", label: "Confirm deposit" },
];
