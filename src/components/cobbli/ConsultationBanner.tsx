import { Mail } from "lucide-react";

const ConsultationBanner = () => (
  <div
    className="rounded-xl p-6 md:p-8 flex items-start gap-4"
    style={{ backgroundColor: "#fff5cc", border: "1px solid #fdb600" }}
  >
    <div
      className="h-10 w-10 rounded-full flex items-center justify-center shrink-0"
      style={{ backgroundColor: "#fdb600", color: "#3d1700" }}
    >
      <Mail size={20} />
    </div>
    <div>
      <h2 className="font-display text-xl text-primary">Not sure what your shoes need?</h2>
      <p className="mt-1 text-sm md:text-base text-primary/80">
        Email us photos at{" "}
        <a href="mailto:support@cobbli.com" className="underline">
          support@cobbli.com
        </a>{" "}
        and we'll recommend the right repairs.
      </p>
    </div>
  </div>
);

export default ConsultationBanner;
