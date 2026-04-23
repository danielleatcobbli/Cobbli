import { ShieldCheck, Award, MessageCircleHeart } from "lucide-react";

const items = [
  {
    icon: ShieldCheck,
    title: "Quality guaranteed",
    desc: "Not happy with your repair? We'll make it right, no questions asked.",
  },
  {
    icon: Award,
    title: "Expert cobblers",
    desc: "Every repair is handled by skilled craftspeople with years of hands-on experience.",
  },
  {
    icon: MessageCircleHeart,
    title: "Dedicated support",
    desc: "Have a question? Reach us any day of the week at support@cobbli.com.",
  },
];

const TrustSignals = () => {
  return (
    <section id="why" className="py-20 md:py-28 bg-background">
      <div className="container">
        <div className="max-w-2xl mb-12">
          <p className="text-sm font-semibold tracking-widest uppercase text-status-orange">
            Why Cobbli
          </p>
          <h2 className="mt-3 text-3xl md:text-5xl font-display font-600 text-balance">
            Your satisfaction, <span className="highlight-mark">guaranteed</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {items.map((it) => (
            <div
              key={it.title}
              className="rounded-xl border border-border bg-card p-8 shadow-soft"
            >
              <div className="h-14 w-14 rounded-full bg-gradient-warm text-primary-foreground flex items-center justify-center">
                <it.icon size={26} strokeWidth={1.75} />
              </div>
              <h3 className="mt-6 text-xl font-display font-600">{it.title}</h3>
              <p className="mt-2 text-muted-foreground leading-relaxed">{it.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TrustSignals;
