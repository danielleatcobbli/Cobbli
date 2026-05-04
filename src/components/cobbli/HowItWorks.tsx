const steps = [
  { n: "1", title: "Choose your services", desc: "Browse our services and add what you need to your bag. Not sure? Email us photos at support@cobbli.com and we’ll make recommend the right repairs within 2 business days." },
  { n: "2", title: "Schedule pickup and return", desc: "Choose a pickup and return window that works for you — evenings and weekends included." },
  { n: "3", title: "We handle the rest", desc: "We'll pick up your shoes and have them back to you within 7 days." },
  { n: "4", title: "We return your shoes", desc: "We'll return your beautifully repaired shoes right to your door during your scheduled return window." },
];

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="py-20 md:py-28 bg-secondary/60">
      <div className="container">
        <div className="max-w-2xl mb-12">
          <p className="text-sm font-semibold tracking-widest uppercase text-status-orange">
            How it works
          </p>
          <h2 className="mt-3 text-3xl md:text-5xl font-display font-600 text-balance">
            Getting your shoes repaired{" "}
            <span className="highlight-mark">has never been easier</span>
          </h2>
        </div>

        <ol className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <li
              key={s.n}
              className="relative rounded-xl bg-card p-7 shadow-soft border border-border"
            >
              <span className="text-status-orange font-display text-sm font-700 tracking-wider">
                {s.n}
              </span>
              <h3 className="mt-3 text-xl font-display font-600">{s.title}</h3>
              <p className="mt-2 text-muted-foreground text-sm leading-relaxed">{s.desc}</p>
              {i < steps.length - 1 && (
                <span className="hidden lg:block absolute top-1/2 -right-3 h-px w-6 bg-border" />
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
};

export default HowItWorks;
