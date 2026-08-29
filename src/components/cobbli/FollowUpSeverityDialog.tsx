import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Camera } from "lucide-react";

/**
 * MOCKUP ONLY (2026-08-27, Danielle's ask: "mock this up before wiring it")
 * — this dialog and SEVERITY_QUESTIONS below are a UI/UX preview for four new
 * follow-up questions (Stains, Scuffs, Scratches, and Worn or missing heel
 * tip), built the same way SoleSelectionDialog was: same big photo-card
 * layout, same "pick whichever looks closest" pattern. What's deliberately
 * NOT done yet, pending her review:
 *   - No real photos. PlaceholderPhoto below is an obvious dashed-border
 *     placeholder, not a stand-in real photo, so it's never mistaken for
 *     finished work.
 *   - No real pricing. Every option's price is a rough illustrative number
 *     (see comment on SEVERITY_QUESTIONS) — nothing here reads from Supabase
 *     or affects what a customer is actually charged.
 *   - The answer a customer picks is captured (StartRepair.tsx stores it and
 *     fires a trackEvent) but does NOT change the resulting cart line yet —
 *     seeRecommendations() still prices Scuffs/Scratches/Stains/heel-tip
 *     exactly as it did before this dialog existed. "Wiring" means both of
 *     the above becoming real, once Danielle approves the flow/wording/
 *     photos and gives real light/heavy price points.
 */

export type SeverityOption = {
  key: string;
  label: string;
  desc: string;
  /** Illustrative only — see file header. */
  mockPriceLabel: string;
};

export type SeverityQuestion = {
  /** The checklist condition label this question is gated on. */
  conditionLabel: string;
  title: string;
  subtitle: string;
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
    subtitle: "Pick whichever looks closest to your shoes — not sure? Send us a photo instead.",
    options: [
      { key: "light", label: "Light staining", desc: "A small spot or light discoloration.", mockPriceLabel: "$50 per pair" },
      { key: "heavy", label: "Heavy staining", desc: "A large area, or a stain that's set in.", mockPriceLabel: "$95 per pair" },
    ],
  },
  {
    conditionLabel: "Scuffs",
    title: "How bad are the scuffs?",
    subtitle: "Pick whichever looks closest to your shoes — not sure? Send us a photo instead.",
    options: [
      { key: "light", label: "Light scuffing", desc: "A few small marks, mostly on the surface.", mockPriceLabel: "$50 per pair" },
      { key: "heavy", label: "Heavy scuffing", desc: "Deep marks, or noticeable wear across the shoe.", mockPriceLabel: "$95 per pair" },
    ],
  },
  {
    conditionLabel: "Scratches",
    title: "How bad are the scratches?",
    subtitle: "Pick whichever looks closest to your shoes — not sure? Send us a photo instead.",
    options: [
      { key: "light", label: "Light scratching", desc: "A few shallow marks.", mockPriceLabel: "$50 per pair" },
      { key: "heavy", label: "Heavy scratching", desc: "Deep marks, or scratches in several spots.", mockPriceLabel: "$95 per pair" },
    ],
  },
  {
    // Danielle's reasoning (2026-08-27): once a heel tip wears through, the
    // material just above it starts making direct contact with the ground
    // and can scuff — so "just the tip" and "tip plus scuffing above it"
    // are genuinely two different repairs, not just two severities of one.
    conditionLabel: "Worn or missing heel tip",
    title: "Is there any scuffing above the heel tip?",
    subtitle: "When a heel tip wears down, the material right above it can start scuffing from hitting the ground directly. Pick whichever looks closest to your shoes.",
    options: [
      { key: "no-scuffing", label: "No scuffing — just the tip", desc: "Only the heel tip itself is worn or missing.", mockPriceLabel: "$35 per pair" },
      // All-in price (not "$35 + $80") per Danielle's call 2026-08-28 — the
      // customer just needs one number for what the repair costs, not a
      // breakdown of the two things being fixed.
      { key: "scuffing", label: "Scuffing above the tip", desc: "The heel tip is worn and the material above it is scuffed too.", mockPriceLabel: "$115 per pair" },
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
};

const FollowUpSeverityDialog = ({ open, onOpenChange, question, onConfirm }: Props) => {
  if (!question) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl md:text-3xl">{question.title}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-2">{question.subtitle}</p>
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
                <span className="text-lg font-bold" style={{ color: "#3d1700" }}>
                  {opt.mockPriceLabel}
                </span>
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
