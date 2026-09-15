import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Camera } from "lucide-react";
import { Link } from "react-router-dom";

/**
 * Built 2026-08-27 as a UI/UX mockup ("mock this up before wiring it") for
 * four follow-up questions (Stains, Scuffs, Scratches, and Worn or missing
 * heel tip), same big photo-card layout/pattern as SoleSelectionDialog.
 *
 * Real pricing wired 2026-09-02 (Danielle's live-pricing pass) for three of
 * the four — Scuffs and Scratches both resolve to the "scuff-repair"
 * catalog service's light/heavy variants, and heel tip resolves to
 * "high-heel-tip-replacement"'s no-scuffing/scuffing variants — see
 * StartRepair.tsx's seeRecommendations(). Stains stays flat-priced ($40,
 * the stain-repair service's only variant) regardless of which option is
 * picked — her pricing table gave it one price, not a light/heavy split, so
 * this question is intentionally still just informational for Stains (same
 * "captured but doesn't affect price" state every question was in before
 * this pass).
 *
 * Still not done:
 *   - No real photos. PlaceholderPhoto below is an obvious dashed-border
 *     placeholder, not a stand-in real photo, so it's never mistaken for
 *     finished work.
 *   - Per-option pricing is captured (StartRepair.tsx stores it and fires a
 *     trackEvent) but deliberately not shown in this dialog — see the
 *     pricing-removal note on SoleSelectionDialog.tsx; same reasoning
 *     applies to these diagnostic questions.
 */

export type SeverityOption = {
  key: string;
  label: string;
  desc: string;
  /** Real per the live catalog as of 2026-09-02 for Scuffs/Scratches/heel
   *  tip (matches scuff-repair and high-heel-tip-replacement's variant
   *  pricing exactly — key must match the variant_key in Supabase, see
   *  seeRecommendations()). Stains' two options both show $40 since that
   *  service is flat-priced regardless of severity — see file header. Not
   *  rendered in the dialog itself (removed 2026-09-01), kept here as
   *  accurate reference data. */
  mockPriceLabel: string;
};

export type SeverityQuestion = {
  /** The checklist condition label this question is gated on. */
  conditionLabel: string;
  title: string;
  options: [SeverityOption, SeverityOption];
};

// Ordered Stains, Scuffs, Scratches, then heel tip — matching CHECKLIST_
// GROUPS' category order (Color & stains, then Scuffs & scratches, then
// Sole & heel), the same "one canonical order, reused everywhere" rule
// StartRepair.tsx already follows for the checklist itself. See
// buildSeverityQueue() in StartRepair.tsx for how this becomes the order
// a customer actually sees them in when more than one applies.
//
// Scuffs and Scratches get separate questions here per Danielle's literal
// ask ("a different question for each") even though both currently map to
// the same scuff-repair service — worth flagging back to her once she sees
// it live: if someone checks both, they'll see two back-to-back questions
// for what's billed as one repair. Easy to merge into a single "how bad is
// the scuffing/scratching" question later if that feels redundant.
export const SEVERITY_QUESTIONS: SeverityQuestion[] = [
  {
    conditionLabel: "Stains",
    title: "How bad is the staining?",
    // Flat-priced regardless of answer — see file header. Both options show
    // the same $40 on purpose, not a copy-paste miss.
    options: [
      { key: "light", label: "Light staining", desc: "A small spot or light discoloration.", mockPriceLabel: "$40 per pair" },
      { key: "heavy", label: "Heavy staining", desc: "A large area, or a stain that's set in.", mockPriceLabel: "$40 per pair" },
    ],
  },
  {
    conditionLabel: "Scuffs",
    title: "How bad are the scuffs?",
    options: [
      { key: "light", label: "Light scuffing", desc: "A few small marks, mostly on the surface.", mockPriceLabel: "$50 per pair" },
      { key: "heavy", label: "Heavy scuffing", desc: "Deep marks, or noticeable wear across the shoe.", mockPriceLabel: "$70 per pair" },
    ],
  },
  {
    conditionLabel: "Scratches",
    title: "How bad are the scratches?",
    options: [
      { key: "light", label: "Light scratching", desc: "A few shallow marks.", mockPriceLabel: "$50 per pair" },
      { key: "heavy", label: "Heavy scratching", desc: "Deep marks, or scratches in several spots.", mockPriceLabel: "$70 per pair" },
    ],
  },
  {
    // Danielle's reasoning (2026-08-27): once a heel tip wears through, the
    // material just above it starts making direct contact with the ground
    // and can scuff — so "just the tip" and "tip plus scuffing above it"
    // are genuinely two different repairs, not just two severities of one.
    conditionLabel: "Worn or missing heel tip",
    // Reworded 2026-09-02 (Danielle's ask) — "damage" was too vague to tell
    // a customer what to actually check for; "scuffing or fraying" are both
    // concrete, visible things, matching each other in specificity. Options
    // reworded the same way so the question and its answers stay
    // consistent.
    title: "Is there any scuffing or fraying above the heel tip?",
    options: [
      { key: "no-scuffing", label: "No — just the tip", desc: "Only the heel tip itself is worn or missing.", mockPriceLabel: "$35 per pair" },
      // All-in price (not "$35 + $50") per Danielle's call 2026-08-28 — the
      // customer just needs one number for what the repair costs, not a
      // breakdown of the two things being fixed.
      { key: "scuffing", label: "Yes — scuffed or frayed above it", desc: "The heel tip is worn and the material just above it is scuffed or frayed too.", mockPriceLabel: "$85 per pair" },
    ],
  },
];

const PlaceholderPhoto = ({ forLabel }: { forLabel: string }) => (
  <span
    className="flex flex-col items-center justify-center gap-1.5 w-full aspect-[4/3] border-2 border-dashed text-center px-3"
    style={{ borderColor: "#c9b896", backgroundColor: "#f5f0e8" }}
  >
    <Camera size={22} style={{ color: "#a89a80" }} />
    <span className="text-[11px] leading-snug" style={{ color: "#8a7a68" }}>
      Photo placeholder — {forLabel}
    </span>
  </span>
);

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Whichever question is currently up in the queue, or null when none. */
  question: SeverityQuestion | null;
  onConfirm: (conditionLabel: string, optionKey: string) => void;
  /** Present only when this isn't the first question in the follow-up
   *  chain (2026-09-02, Danielle's ask: "let the user go back when they're
   *  answering the questions"). Omitted entirely (rather than a no-op)
   *  hides the "← Back" link below. */
  onBack?: () => void;
  /** Checklist conditions already checked, carried into the "Not sure?"
   *  link's router state so a customer who bails to the photo flow from
   *  here doesn't lose that context (2026-09-02, Danielle's ask). */
  requestedConditions?: string[];
};

const FollowUpSeverityDialog = ({ open, onOpenChange, question, onConfirm, onBack, requestedConditions }: Props) => {
  if (!question) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        {/* Eyebrow (2026-09-02, Danielle's ask) — question.title alone
            doesn't always name which checklist condition it's about (e.g.
            "Is there any scuffing above the heel tip?" implies but doesn't
            state "Worn or missing heel tip"). Same treatment as
            SoleSelectionDialog. */}
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#8a7a68" }}>
          {question.conditionLabel}
        </p>
        <DialogHeader>
          <DialogTitle className="text-2xl md:text-3xl">{question.title}</DialogTitle>
        </DialogHeader>
        {/* Back (2026-09-02, Danielle's ask) — only rendered when this isn't
            the first question in the follow-up chain. */}
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="-mt-2 text-sm font-medium hover:opacity-80 w-fit"
            style={{ color: "#7a5c40" }}
          >
            ← Back
          </button>
        )}
        {/* Simplified to just this one fully-hyperlinked line (2026-09-01,
            Danielle's call: "that will be the only description") — replaces
            each question's own "Pick whichever looks closest..." subtitle
            text. Same treatment as SoleSelectionDialog.tsx and
            SoleMaterialDialog.tsx. Carries requestedConditions (2026-09-02)
            so staff can see what was already checked if the customer bails
            to the photo flow from here. */}
        <Link
          to="/start-repair/assessment"
          state={{ requestedConditions }}
          className="block text-sm font-medium underline -mt-2"
          style={{ color: "#3d1700" }}
        >
          Not sure? Send us a photo instead
        </Link>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
          {question.options.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => onConfirm(question.conditionLabel, opt.key)}
              className="flex flex-col text-left rounded-lg border border-border overflow-hidden hover:border-primary/60 transition-colors"
            >
              <PlaceholderPhoto forLabel={opt.label} />
              <span className="flex flex-col gap-1 p-4">
                <span className="text-base font-semibold text-primary">{opt.label}</span>
                {/* mockPriceLabel intentionally no longer rendered
                    (2026-09-02, Danielle's call) — see the pricing-removal
                    note on SoleSelectionDialog.tsx; same reasoning applies
                    here. Left on SeverityOption/SEVERITY_QUESTIONS since
                    it's still useful reference for whoever wires real
                    pricing into the final quote later. */}
                <span className="text-sm text-muted-foreground leading-snug">{opt.desc}</span>
              </span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FollowUpSeverityDialog;
