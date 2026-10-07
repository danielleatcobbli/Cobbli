import { Info } from "lucide-react";
import { recommendationGroups, type Recommendation } from "@/lib/recommendations";
import { formatPrice } from "@/context/BagContext";

export default function RecommendationChoices({ lines, selected, onToggle, disabled, complimentary }: {
  lines: Recommendation[]; selected: Set<string>; onToggle: (id: string) => void;
  disabled: boolean; complimentary: boolean;
}) {
  const price = (line: Recommendation) => complimentary || line.price_cents === 0 ? "Complimentary" : formatPrice(line.price_cents);
  return <div className="mt-5 divide-y divide-border">{recommendationGroups(lines).map(options => {
    const first = options[0];
    const alternative = Boolean(first.choice_group);
    const current = options.find(line => selected.has(line.recommendation_id!));
    const preferred = options.find(line => line.preferred) || first;
    const title = alternative ? first.choice_group_label || first.choice_group : first.name;
    const tier = first.tier || "recommended";
    return <fieldset key={first.recommendation_id} className="py-6 first:pt-2" disabled={disabled}>
      <legend className="sr-only">{title}</legend>
      <div className="flex items-start gap-3 sm:gap-4">
        <input type="checkbox" checked={!!current} disabled={disabled}
          aria-label={alternative ? `Include ${title}` : first.name}
          onChange={() => onToggle((current || preferred).recommendation_id!)}
          className="mt-1 h-5 w-5 shrink-0 accent-[#42200d] cursor-pointer disabled:cursor-default" />
        <div className="min-w-0 flex-1">
          <span className="inline-block rounded-full bg-[#fff4d5] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary">{tier}</span>
          <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h3 className="font-display text-xl font-semibold text-primary">{title}</h3>
            {!alternative && <span className="text-sm font-semibold text-primary">{price(first)}</span>}
          </div>
          {alternative ? <div className="mt-4 space-y-4">
            {options.map(line => <label key={line.recommendation_id} className="flex items-start gap-3 cursor-pointer">
              <input type="radio" name={`repair-${line.pair_id}-${first.choice_group}`} checked={selected.has(line.recommendation_id!)}
                disabled={disabled} onChange={() => { if (!selected.has(line.recommendation_id!)) onToggle(line.recommendation_id!); }}
                className="mt-1 h-5 w-5 shrink-0 accent-[#42200d]" />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap justify-between gap-x-3 gap-y-1"><span className="font-medium text-primary">{line.name}</span><span className="text-sm font-semibold">{price(line)}</span></span>
                {line.rationale && <span className="mt-1 block text-sm text-muted-foreground">{line.rationale}</span>}
                {line.limitations && <span className="mt-2 flex items-start gap-2 rounded-lg bg-[#fff7df] p-3 text-sm text-primary"><Info size={16} className="mt-0.5 shrink-0" />{line.limitations}</span>}
              </span>
            </label>)}
          </div> : <>
            {first.rationale && <p className="mt-1 text-sm text-muted-foreground">{first.rationale}</p>}
            {first.limitations && <p className="mt-2 flex items-start gap-2 rounded-lg bg-[#fff7df] p-3 text-sm text-primary"><Info size={16} className="mt-0.5 shrink-0" />{first.limitations}</p>}
          </>}
        </div>
      </div>
    </fieldset>;
  })}</div>;
}
