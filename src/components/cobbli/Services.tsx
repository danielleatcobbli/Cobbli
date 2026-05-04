import { Footprints, Hammer, Sparkles, Heart, Wrench, Scissors } from "lucide-react";

const services = [
  { icon: Footprints, title: "Heels & Soles", desc: "Replace worn heels and resole everyday wear." },
  { icon: Hammer, title: "Stitching & Repair", desc: "Re-stitch seams and rebuild damaged uppers." },
  { icon: Sparkles, title: "Polish & Renew", desc: "Hand-polished finish that brings shoes back to life." },
  { icon: Heart, title: "Leather Care", desc: "Conditioning, dyeing and protective treatments." },
  { icon: Wrench, title: "Boot Restoration", desc: "Heritage-grade restoration for boots you love." },
  { icon: Scissors, title: "Custom Work", desc: "Bespoke alterations from our master cobblers." },
];

const Services = () => {
  return (
    <section id="services" className="py-20 md:py-28 bg-white">
      <div className="container">
        <div className="max-w-2xl mb-12">
          <p className="text-sm font-semibold tracking-widest uppercase text-status-orange">
            Services
          </p>
          <h2 className="mt-3 text-3xl md:text-5xl font-display font-600 text-balance">
            Book your <span className="highlight-mark">professional repair</span> today
          </h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
          {services.map((s) => (
            <a
              key={s.title}
              href="#book"
              className="group rounded-xl border border-border bg-card p-6 md:p-7 shadow-soft hover:shadow-elevated hover:border-primary/40 transition-all"
            >
              <div className="h-12 w-12 rounded-lg bg-secondary flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <s.icon size={22} strokeWidth={1.75} />
              </div>
              <h3 className="mt-5 text-lg font-display font-600">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Services;
