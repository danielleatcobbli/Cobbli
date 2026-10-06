import { type ReactNode } from "react";
import { MessageSquare, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import RecommendationChoices from "@/components/cobbli/RecommendationChoices";
import { type Recommendation } from "@/lib/recommendations";
import { formatPrice } from "@/context/BagContext";

export type ReviewBag = { id?: string; photo?: string; label: string; lines: Recommendation[] };
export default function RecommendationReview({ bags, selected, onToggle, complimentary, disabled = false, canContinue,
  onContinue, onPhoto, notice, pickup, onEdit }: {
  bags: ReviewBag[]; selected: Set<string>; onToggle: (id: string) => void; complimentary: boolean;
  disabled?: boolean; canContinue: boolean; onContinue: () => void; onPhoto?: (index: number) => void;
  notice?: string; pickup?: ReactNode; onEdit?: () => void;
}) {
  const selectedLines = bags.flatMap(b => b.lines).filter(l => selected.has(l.recommendation_id!));
  const total = complimentary ? 0 : selectedLines.reduce((sum, l) => sum + l.price_cents, 0);
  return <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
    <div className="min-w-0 space-y-5">
      {pickup ? <section className="rounded-xl border border-border p-5 sm:p-7">
        <div className="mb-5 flex items-center justify-between gap-3"><h2 className="font-display text-2xl font-semibold text-primary">Pickup &amp; final review</h2>
          <Button type="button" variant="link" disabled={disabled} onClick={onEdit}>Edit selections</Button></div>
        {pickup}
      </section> : bags.map((bag, index) => <section key={bag.id || index} className="rounded-xl border border-border p-5 sm:p-7">
        <div className="flex items-center gap-4 border-b border-border pb-5">
          <button type="button" disabled={!bag.photo} onClick={() => onPhoto?.(index)} aria-label={`View ${bag.label} photos`}
            className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#f5f0e8]">
            {bag.photo ? <img src={bag.photo} alt={bag.label} className="h-full w-full object-cover" /> : <ShoppingBag size={30} className="text-primary/50" />}
          </button>
          <div><h2 className="font-display text-2xl font-semibold text-primary">{bag.label}</h2><p className="text-sm text-muted-foreground">Your repair options</p></div>
        </div>
        <RecommendationChoices lines={bag.lines} selected={selected} onToggle={onToggle} complimentary={complimentary} disabled={disabled} />
        {!bag.lines.length && <p className="pt-4 text-sm text-muted-foreground">No recommendations for this bag yet.</p>}
      </section>)}
      {!pickup && <a href="mailto:support@cobbli.com" className="inline-flex items-center gap-2 text-sm text-primary underline underline-offset-4"><MessageSquare size={18} />Have a question? Email us</a>}
    </div>
    <aside aria-label="Your selections" className="rounded-xl border border-[#efdfb5] bg-[#fff8df] p-6 lg:sticky lg:top-6">
      <h2 className="font-display text-3xl font-semibold text-primary">Your selections</h2>
      <p className="mt-2 text-primary" aria-live="polite">{selectedLines.length} {selectedLines.length === 1 ? "repair" : "repairs"} selected</p>
      {pickup && <ul className="mt-4 space-y-3 text-sm">{bags.map(bag => {
        const work = bag.lines.filter(l => selected.has(l.recommendation_id!));
        return work.length ? <li key={bag.id || bag.label}><strong>{bag.label}</strong><ul className="mt-1 space-y-1">{work.map(l => <li key={l.recommendation_id}>{l.name}{l.limitations && <span className="block text-xs text-muted-foreground">{l.limitations}</span>}</li>)}</ul></li> : null;
      })}</ul>}
      <dl className="mt-5 space-y-3 border-t border-[#e6d8bc] pt-5 text-sm">
        <div className="flex justify-between gap-3"><dt>Repairs</dt><dd>{total === 0 ? "Complimentary" : formatPrice(total)}</dd></div>
        <div className="flex justify-between gap-3"><dt>Pickup &amp; return</dt><dd>Complimentary</dd></div>
        <div className="flex flex-wrap justify-between gap-2 border-t border-[#e6d8bc] pt-4 text-lg font-semibold"><dt>{complimentary ? "Total" : "Estimated total"}</dt><dd>{total === 0 ? "Complimentary" : formatPrice(total)}</dd></div>
      </dl>
      {complimentary && <p className="mt-3 text-sm text-muted-foreground">Complimentary during our pilot.</p>}
      {notice && <p role="status" className="mt-4 text-sm">{notice}</p>}
      {!pickup && <>
        <Button type="button" size="lg" onClick={onContinue} disabled={!canContinue || disabled}
          className="mt-6 w-full disabled:bg-stone-300 disabled:text-stone-600 disabled:opacity-100">Continue to pickup</Button>
        {selectedLines.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Select at least one repair to continue.</p> : <p className="mt-3 text-xs text-muted-foreground">Nothing is confirmed until the next step.</p>}
        {bags.some(b => b.lines.length > 0 && !b.lines.some(l => selected.has(l.recommendation_id!))) && <p className="mt-3 text-xs text-muted-foreground">Bags with no selected repairs won’t be included in your pickup.</p>}
      </>}
    </aside>
  </div>;
}
