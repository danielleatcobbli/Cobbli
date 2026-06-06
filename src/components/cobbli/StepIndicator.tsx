export type StepItem<T extends string = string> = { id: T; label: string };

type Props<T extends string> = {
  steps?: StepItem<T>[];
  current: T;
  ariaLabel?: string;
};

const DEFAULT_STEPS: StepItem[] = [
  { id: "pick", label: "Pick a pair" },
  { id: "select", label: "Select services" },
];

function StepIndicator<T extends string>({
  steps = DEFAULT_STEPS as StepItem<T>[],
  current,
  ariaLabel = "Progress",
}: Props<T>) {
  return (
    <div role="navigation" aria-label={ariaLabel} className="border-b border-border">
      <div className="container flex gap-8 overflow-x-auto">
        {steps.map((s) => {
          const active = s.id === current;
          return (
            <div
              key={s.id}
              className={`relative py-4 text-sm md:text-base font-medium whitespace-nowrap ${
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
}

export default StepIndicator;
