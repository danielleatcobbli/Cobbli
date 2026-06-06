import { Link } from "react-router-dom";
import { Camera, Pointer } from "lucide-react";
import Header from "@/components/cobbli/Header";
import Footer from "@/components/cobbli/Footer";
import { usePageMeta } from "@/hooks/usePageMeta";

const PathCard = ({
  icon: Icon,
  title,
  description,
  ctaLabel,
  to,
}: {
  icon: typeof Pointer;
  title: string;
  description: string;
  ctaLabel: string;
  to: string;
}) => (
  <Link
    to={to}
    className="group flex flex-col rounded-xl bg-white p-6 md:p-8 transition-shadow hover:shadow-md"
    style={{ border: "1.5px solid #3d1700" }}
  >
    <div
      className="h-12 w-12 rounded-full flex items-center justify-center mb-5"
      style={{ backgroundColor: "#fff5cc", color: "#3d1700" }}
    >
      <Icon size={22} />
    </div>
    <h2 className="font-display text-2xl text-primary">{title}</h2>
    <p className="mt-2 text-primary/80">{description}</p>
    <span className="mt-6 inline-flex items-center gap-1 font-medium text-primary group-hover:underline">
      {ctaLabel} <span aria-hidden>→</span>
    </span>
  </Link>
);

const StartRepair = () => {
  usePageMeta({
    title: "Start your repair — Cobbli",
    description:
      "Start a Cobbli shoe repair. Choose your own services, or upload photos and let our cobblers recommend the right repairs for your shoes.",
  });

  return (
    <main className="min-h-screen bg-white flex flex-col">
      <Header />
      <section className="flex-1 py-12 md:py-16">
        <div className="container max-w-3xl">
          <h1 className="font-display text-3xl md:text-4xl text-primary">Start your repair</h1>
          <p className="mt-3 text-primary/80 md:text-lg">
            Do you know what services your shoes need or would you like us to make a recommendation?
          </p>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
            <PathCard
              icon={Pointer}
              title="I know what I need"
              description="Confirm your shoe details, browse services, and add what you need to your bag."
              ctaLabel="Start a repair"
              to="/start-repair/pick"
            />
            <PathCard
              icon={Camera}
              title="Not sure what I need"
              description="Upload photos or a short video and we'll recommend the right repairs."
              ctaLabel="Get a recommendation"
              to="/start-repair/assessment"
            />
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
};

export default StartRepair;
