import ComingSoonVoteButton from "@/components/cobbli/ComingSoonVoteButton";
import BeforeAfterImage from "@/components/cobbli/BeforeAfterImage";
import { SLUG_TO_CONDITION_IMAGE } from "@/data/starterRepairConditions";
import type { Service } from "@/types/service";

type Props = {
  services: Service[];
  /** Map of slug → service_id so we can record votes. */
  serviceIdBySlug: Record<string, string>;
  /** Kept for backward compatibility — coming-soon cards have no links in this design. */
  disableLinks?: boolean;
};

/** Per-service crop position override for the aspect-[4/5] photo box.
 *  Default is centered (object-cover's default); only set an entry here when
 *  the default center crop hides the actual point of interest. Heel repair's
 *  before photo has the broken heel sitting on the right side of a roughly
 *  square source image, which a centered crop in a taller 4:5 box cuts off —
 *  2026-08-24 (Danielle's call). */
const IMAGE_POSITION_OVERRIDES: Record<string, string> = {
  "heel-reattachment": "right center",
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const ComingSoonSection = ({ services, serviceIdBySlug, disableLinks: _disableLinks }: Props) => {
  if (services.length === 0) return null;

  return (
    <section className="mt-16" id="coming-soon">
      <h2 className="text-xl md:text-2xl font-display text-primary mb-1">Coming soon</h2>
      <p className="text-sm mb-6" style={{ color: "#7a5c40" }}>
        Vote for what you'd like us to offer next
      </p>
      {/* Image box now matches the active-services tile (ServiceCard.tsx)
          exactly, 2026-08-24 (Danielle's call) — same aspect-[4/5] brown box,
          same BeforeAfterImage hover-swap, same s.imageUrl ?? checklist-photo
          fallback. Cards with no photo yet just show the plain brown box,
          same as an active service without a photo would. Vote button stays
          put below the text either way. */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5 md:gap-6">
        {services.map((s) => {
          const id = serviceIdBySlug[s.slug];
          return (
            <div
              key={s.slug}
              className="rounded-xl border border-border bg-card shadow-soft overflow-hidden flex flex-col"
              style={{ opacity: 0.8 }}
            >
              <div className="aspect-[4/5] relative overflow-hidden" style={{ backgroundColor: "#3d1700" }}>
                <BeforeAfterImage
                  before={s.imageUrl ?? SLUG_TO_CONDITION_IMAGE.get(s.slug)?.imageUrl}
                  after={s.afterImageUrl ?? SLUG_TO_CONDITION_IMAGE.get(s.slug)?.afterImageUrl}
                  alt={s.name}
                  className="absolute inset-0 w-full h-full object-cover"
                  style={
                    IMAGE_POSITION_OVERRIDES[s.slug]
                      ? { objectPosition: IMAGE_POSITION_OVERRIDES[s.slug] }
                      : undefined
                  }
                />
              </div>
              <div className="p-4 flex flex-col gap-1 flex-1">
                <h3
                  className="text-[14px] font-bold leading-snug"
                  style={{ color: "#3d1700" }}
                >
                  {s.name}
                </h3>
                {s.description && (
                  <p className="text-[12px] leading-snug mt-0.5 flex-1" style={{ color: "#7a5c40" }}>
                    {s.description}
                  </p>
                )}
                <div className="pt-3">
                  <ComingSoonVoteButton serviceId={id} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default ComingSoonSection;
