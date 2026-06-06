import { Link } from "react-router-dom";
import { useState, type ReactNode } from "react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Plus, Minus } from "lucide-react";
import Header from "@/components/cobbli/Header";
import Footer from "@/components/cobbli/Footer";

const Email = () => (
  <a href="mailto:support@cobbli.com" className="underline underline-offset-4">
    support@cobbli.com
  </a>
);

const faqs: { q: string; a: ReactNode }[] = [
  {
    q: "How does Cobbli work?",
    a: (
      <p>
        Simply add the services you need to your bag and check out. We take care of the rest: we'll pick up
        your shoes, expertly repair them, and return them to your doorstep.
      </p>
    ),
  },
  {
    q: "What areas do you service?",
    a: (
      <div className="space-y-3">
        <p>
          We currently service the below Manhattan neighborhoods. Enter your address at checkout and we'll
          let you know if you're within our coverage zone.
        </p>
        <p className="pl-4">
          Alphabet City, Battery Park City, Chelsea, Chinatown, East Village, FiDi, Flatiron, Gramercy,
          Little Italy, Lower East Side, NoHo, SoHo, Tribeca, Union Square, West Village
        </p>
        <p>
          Don't see your neighborhood? Email us at <Email /> and let us know where you are. We use your
          feedback to prioritize new coverage areas.
        </p>
      </div>
    ),
  },
  {
    q: "How do I schedule my pickup and return?",
    a: (
      <p>
        We will text the phone number provided during checkout to schedule your pickup. Once your shoes are
        ready, we will text you to schedule your return.
      </p>
    ),
  },
  {
    q: "Is there a fee for pickup and delivery?",
    a: (
      <p>
        Courier service is free on orders over $100. For orders under $100, a flat $15 courier fee applies.
      </p>
    ),
  },
  {
    q: "How long do repairs take?",
    a: (
      <p>
        Repairs are completed within 7 calendar days. If your shoes are ready early, we'll let you know.
      </p>
    ),
  },
  {
    q: "What if I don't know what services I need?",
    a: (
      <p>
        Not sure what your shoes need? Upload photos or a short video and we'll recommend the right repairs.{" "}
        <Link to="/start-repair/assessment" className="underline underline-offset-4 hover:text-primary">
          Get a personalised recommendation →
        </Link>
      </p>
    ),
  },
  {
    q: "Is it worth repairing my shoes?",
    a: (
      <p>
        Well-made shoes are built to last – with the right care, a repair is more
        cost-effective than replacement. Repair is also more sustainable than replacement, as manufacturing
        new shoes is a resource-intensive process.
      </p>
    ),
  },
  {
    q: "Are my shoes repairable?",
    a: (
      <div className="space-y-3">
        <p>
          It depends on the shoe. Well-made shoes crafted from leather (including nubuck and suede) or
          canvas are almost always repairable and can last a lifetime with the right care. However, even
          well-made shoes can become impossible to repair with neglect – it's important to repair good
          shoes when you notice an issue so they don't get beyond fixing.
        </p>
        <p>
          Cheaply made shoes tend not to be worthwhile to repair, except when it comes to minor fixes like
          a heel tip repair.
        </p>
        <div>
          <p className="font-medium text-foreground">Signs it's time to replace:</p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>The leather on the shoe has cracked</li>
            <li>The shoe has lost its shape and the structure has collapsed</li>
            <li>
              The shoe was cheaply constructed (made from synthetic or thin materials, soles that were
              glued instead of stitched on)
            </li>
          </ul>
        </div>
        <p>
          If you're unsure whether your shoes are worth repairing, send us a photo at <Email /> before
          booking and we'll give you an honest assessment. We'd rather save you the money.
        </p>
      </div>
    ),
  },
  {
    q: "Do you offer order guarantees?",
    a: (
      <p>
        Yes. If you're not satisfied with your repair, contact us at <Email /> within 14 days of receiving
        your shoes.
      </p>
    ),
  },
  {
    q: "How do I contact Cobbli?",
    a: (
      <p>
        Email us any day at <Email />. We typically respond within 2 business days.
      </p>
    ),
  },
];

const Faqs = () => {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  usePageMeta({
    title: "FAQs — Cobbli",
    description:
      "Answers to common questions about Cobbli's NYC shoe repair service: pickup and return, pricing, turnaround times, service area and order guarantees.",
  });

  return (
    <main className="min-h-screen flex flex-col bg-white">
      <Header />
      <section className="flex-1 py-16 md:py-24">
        <div className="container max-w-3xl">
          <h1 className="font-display text-4xl md:text-5xl font-600 text-balance">
            Frequently asked questions
          </h1>

          <ul className="mt-10 border-t border-border">
            {faqs.map((f, i) => {
              const isOpen = openIdx === i;
              return (
                <li key={i} className="border-b border-border">
                  <button
                    type="button"
                    onClick={() => setOpenIdx(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    className="w-full flex items-start justify-between gap-6 py-5 text-left"
                  >
                    <span className="font-display text-lg md:text-xl font-600 text-primary">{f.q}</span>
                    <span
                      aria-hidden="true"
                      className="shrink-0 mt-1 h-6 w-6 flex items-center justify-center text-primary"
                    >
                      {isOpen ? <Minus size={20} /> : <Plus size={20} />}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="pb-6 pr-10 text-base text-muted-foreground leading-relaxed">
                      {f.a}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </section>
      <Footer />
    </main>
  );
};

export default Faqs;
