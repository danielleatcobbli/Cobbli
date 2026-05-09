type Step = "pick" | "select";

const steps: { id: Step; label: string }[] = [
  { id: "pick", label: "Pick a pair" },
  { id: "select", label: "Select services" },
];

const StepIndicator = ({ current }: { current: Step }) => (
  <div role="navigation" aria-label="Repair progress" className="border-b border-border">
    <div className="container flex gap-8">
      {steps.map((s) => {
        const active = s.id === current;
        return (
          <div
            key={s.id}
            className={`relative py-4 text-sm md:text-base font-medium ${
              active ? "text-primary" : "text-muted-foreground"
            }`}
            aria-current={active ? "step" : undefined}
          >
            {s.label}
            {active && (
              <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-status-orange rounded-full" />
            )}
          </div>
        );
      })}
    </div>
  </div>
);

export default StepIndicator;
