import ComingSoonVoteButton from "@/components/cobbli/ComingSoonVoteButton";
import type { Service } from "@/types/service";

type Props = {
  services: Service[];
  /** Map of slug → service_id so we can record votes. */
  serviceIdBySlug: Record<string, string>;
  /** Kept for backward compatibility — coming-soon cards have no links in this design. */
  disableLinks?: boolean;
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
      {/* No image on these cards (2026-07-27, Danielle's call) — there's no
          real photo for a service that doesn't exist yet, so the placeholder
          tan box was just dead space. Just name, description, and the vote
          button now. The per-card "Coming soon" pill is dropped too, since
          the section heading right above already says that. */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5 md:gap-6">
        {services.map((s) => {
          const id = serviceIdBySlug[s.slug];
          return (
            <div
              key={s.slug}
              className="rounded-xl border border-border bg-card shadow-soft flex flex-col p-4 gap-1"
              style={{ opacity: 0.8 }}
            >
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
          );
        })}
      </div>
    </section>
  );
};

export default ComingSoonSection;
