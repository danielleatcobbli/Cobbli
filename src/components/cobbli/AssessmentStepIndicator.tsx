type Step = 1 | 2 | 3;

const STEPS: { id: Step; label: string }[] = [
  { id: 1, label: "Upload" },
  { id: 2, label: "Review your details" },
  { id: 3, label: "Confirm deposit" },
];

const AssessmentStepIndicator = ({ current }: { current: Step }) => (
  <div role="navigation" aria-label="Assessment progress" className="border-b border-border">
    <div className="container flex gap-8 overflow-x-auto">
      {STEPS.map((s) => {
        const active = s.id <= current;
        const isCurrent = s.id === current;
        return (
          <div
            key={s.id}
            className={`relative py-4 text-sm md:text-base font-medium whitespace-nowrap ${
              active ? "text-primary" : "text-muted-foreground"
            }`}
            aria-current={isCurrent ? "step" : undefined}
          >
            <span className="mr-2 text-xs opacity-70">Step {s.id}</span>
            {s.label}
            {isCurrent && (
              <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-status-orange rounded-full" />
            )}
          </div>
        );
      })}
    </div>
  </div>
);

export default AssessmentStepIndicator;
