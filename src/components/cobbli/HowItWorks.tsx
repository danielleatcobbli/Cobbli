import { Link } from "react-router-dom";

const steps = [
  {
    n: "1",
    title: "Tell us what's wrong",
    desc: (
      <>
        Tell us what's wrong with your shoes or send us a photo or video. Either way, we'll
        recommend the right repairs.{" "}
        <Link to="/start-repair" className="underline hover:text-primary">
          Start a repair →
        </Link>
      </>
    ),
  },
  { n: "2", title: "Schedule your pickup", desc: "Check out and select the pickup window that works best for you. We'll come to you then." },
  { n: "3", title: "We handle the rest", desc: "We repair your shoes in-house and let you know as soon as they're ready to schedule your return." },
];

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="py-20 md:py-28 bg-secondary/60">
      <div className="container">
        <div className="max-w-2xl mb-12">
          <p className="text-sm font-semibold tracking-widest uppercase text-status-orange">
            How it works
          </p>
          <h2 className="mt-3 text-3xl md:text-5xl text-balance">
            Getting your shoes repaired{" "}
            <span style={{ fontWeight: 900 }}>has never been easier</span>
          </h2>
        </div>

        <ol className="grid gap-5 md:grid-cols-3">
          {steps.map((s, i) => (
            <li
              key={s.n}
              className="relative rounded-xl bg-card p-7 shadow-soft border border-border"
            >
              <span className="text-status-orange text-sm tracking-wider">
                {s.n}
              </span>
              <h3 className="mt-3 text-xl">{s.title}</h3>
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