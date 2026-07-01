import { Link } from "react-router-dom";
import ComingSoonVoteButton from "@/components/cobbli/ComingSoonVoteButton";
import type { Service } from "@/types/service";

type Props = {
  services: Service[];
  /** Map of slug → service_id so we can record votes. */
  serviceIdBySlug: Record<string, string>;
  /** When true, card title/thumbnail do not link to the detail page. */
  disableLinks?: boolean;
};

const ComingSoonSection = ({ services, serviceIdBySlug, disableLinks = false }: Props) => {
  if (services.length === 0) return null;

  return (
    <section className="mt-16">
      <h2 className="text-xl md:text-2xl text-primary mb-2">
        Coming soon — vote for what you'd like us to offer next
      </h2>
      <p className="text-sm text-muted-foreground mb-6">
        Your votes help us decide what to add
      </p>
      <div className="flex flex-wrap gap-5 md:gap-6">
        {services.map((s) => {
          const id = serviceIdBySlug[s.slug];
          return (
            <div
              key={s.slug}
              className="w-[calc((100%-1.25rem)/2)] md:w-[calc((100%-2*1.5rem)/3)] xl:w-[calc((100%-3*1.5rem)/4)] flex"
            >
              <div className="w-full rounded-xl overflow-hidden border border-border bg-card shadow-soft flex flex-col">
                {disableLinks ? (
                  <div
                    className="aspect-[4/3] flex items-center justify-center text-center px-4 relative"
                    style={{ backgroundColor: "#3d1700", color: "#fdb600", opacity: 0.55 }}
                  >
                    <span className="text-xl">{s.cardName || s.name}</span>
                    <span
                      className="absolute top-2 left-2 text-[10px] font-medium px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: "#fdb600", color: "#3d1700" }}
                    >
                      Coming soon
                    </span>
                  </div>
                ) : (
                  <Link to={`/services/${s.slug}`} className="block">
                    <div
                      className="aspect-[4/3] flex items-center justify-center text-center px-4 relative"
                      style={{ backgroundColor: "#3d1700", color: "#fdb600", opacity: 0.55 }}
                    >
                      <span className="text-xl">{s.cardName || s.name}</span>
                      <span
                        className="absolute top-2 left-2 text-[10px] font-medium px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: "#fdb600", color: "#3d1700" }}
                      >
                        Coming soon
                      </span>
                    </div>
                  </Link>
                )}
                <div className="p-5 flex flex-col gap-1 flex-1">
                  {disableLinks ? (
                    <h3 className="text-[15px] leading-snug text-primary">{s.cardName || s.name}</h3>
                  ) : (
                    <Link to={`/services/${s.slug}`} className="hover:underline">
                      <h3 className="text-[15px] leading-snug text-primary">{s.cardName || s.name}</h3>
                    </Link>
                  )}
                </div>
                <div className="px-5 pb-5">
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
