import { useNavigate } from "react-router-dom";
import { Camera, Pointer } from "lucide-react";
import Header from "@/components/cobbli/Header";
import Footer from "@/components/cobbli/Footer";
import { usePageMeta } from "@/hooks/usePageMeta";


const PathCard = ({
  icon: Icon,
  title,
  description,
  ctaLabel,
  onClick,
}: {
  icon: typeof Pointer;
  title: string;
  description: string;
  ctaLabel: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className="group flex flex-col rounded-xl bg-white p-6 md:p-8 transition-shadow hover:shadow-md text-left"
    style={{ border: "1.5px solid #3d1700" }}
  >
    <div
      className="h-12 w-12 rounded-full flex items-center justify-center mb-5"
      style={{ backgroundColor: "#fff5cc", color: "#3d1700" }}
    >
      <Icon size={22} />
    </div>
    <h2 className="text-2xl text-primary">{title}</h2>
    <p className="mt-2 text-primary/80">{description}</p>
    <span className="mt-6 inline-flex items-center gap-1 font-medium text-primary group-hover:underline">
      {ctaLabel} <span aria-hidden>→</span>
    </span>
  </button>
);

const StartRepair = () => {
  const navigate = useNavigate();

  usePageMeta({
    title: "Start your repair — Cobbli",
    description:
"Start a Cobbli shoe repair. Choose your own services, or upload photos and let our cobblers recommend the right repairs for your shoes.",
  });

  const go = (to: string) => navigate(to);

  return (
    <main className="min-h-screen bg-white flex flex-col">
      <Header />
      <section className="flex-1 py-12 md:py-16">
        <div className="container max-w-3xl">
          <h1 className="font-display text-3xl md:text-4xl text-primary">Do you know what your shoes need?</h1>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
            <PathCard
              icon={Pointer}
              title="Yes"
              description="Confirm your shoe details, browse services, and add what you need to your bag."
              ctaLabel="Start a repair"
              onClick={() => go("/start-repair/pick")}
            />
            <PathCard
              icon={Camera}
              title="No"
              description="Upload photos or a short video and we'll recommend the right repairs."
              ctaLabel="Get a recommendation"
              onClick={() => go("/start-repair/assessment")}
            />
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
};

export default StartRepair;
