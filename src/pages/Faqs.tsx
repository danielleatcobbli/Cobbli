import { useEffect } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import Header from "@/components/cobbli/Header";
import Footer from "@/components/cobbli/Footer";

const faqs = [
  {
    q: "How does Cobbli's pickup and return work?",
    a: "Once you've placed your order, we'll text you to schedule a pickup and return at the times that work best for you. A courier will collect your shoes and deliver them back once the repairs are complete.",
  },
  {
    q: "How long do repairs take?",
    a: "Most repairs are completed within 7 days from pickup. More complex restorations may take longer — we'll keep you updated throughout the process.",
  },
  {
    q: "How much does courier service cost?",
    a: "Courier service is $15 for orders under $100, and free for orders $100 and over.",
  },
  {
    q: "What if I'm not sure what repairs my shoes need?",
    a: (
      <>
        Email us photos at{" "}
        <a href="mailto:support@cobbli.com" className="underline underline-offset-4">
          support@cobbli.com
        </a>{" "}
        and we'll recommend the right repairs within 1 business day.
      </>
    ),
  },
  {
    q: "Where do you operate?",
    a: "Cobbli currently provides door-to-door pickup and return across Manhattan.",
  },
  {
    q: "How do I contact support?",
    a: (
      <>
        You can reach us anytime at{" "}
        <a href="mailto:support@cobbli.com" className="underline underline-offset-4">
          support@cobbli.com
        </a>{" "}
        and we'll get back to you within 2 business days.
      </>
    ),
  },
];

const Faqs = () => {
  useEffect(() => {
    document.title = "FAQs — Cobbli";
    const desc =
      "Frequently asked questions about Cobbli's shoe repair, pickup and return, pricing, and turnaround times.";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", desc);
  }, []);

  return (
    <main className="min-h-screen flex flex-col bg-white">
      <Header />
      <section className="flex-1 py-16 md:py-24">
        <div className="container max-w-3xl">
          <h1 className="font-display text-4xl md:text-5xl font-600 text-balance">
            Frequently asked questions
          </h1>
          <p className="mt-4 text-muted-foreground">
            Answers to the things customers ask us most.
          </p>

          <Accordion type="single" collapsible className="mt-10">
            {faqs.map((f, i) => (
              <AccordionItem key={i} value={`item-${i}`}>
                <AccordionTrigger className="text-left font-display text-lg">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="text-base text-muted-foreground leading-relaxed">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>
      <Footer />
    </main>
  );
};

export default Faqs;
