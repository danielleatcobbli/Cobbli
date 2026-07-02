import { Link } from "react-router-dom";
import { Camera } from "lucide-react";

const ConsultationBanner = () => (
  <Link
    to="/start-repair/assessment"
    className="block rounded-xl p-6 md:p-8 transition-shadow hover:shadow-md"
    style={{ backgroundColor: "#fff5cc", border: "1px solid #fdb600" }}
  >
    <div className="flex items-start gap-4">
      <div
        className="h-10 w-10 rounded-full flex items-center justify-center shrink-0"
        style={{ backgroundColor: "#fdb600", color: "#3d1700" }}
      >
        <Camera size={20} />
      </div>
      <div>
        <h2 className="text-xl text-primary">Not sure what your shoes need?</h2>
        <p className="mt-1 text-sm md:text-base text-primary/80">
          Get a personalized recommendation <span aria-hidden>→</span>
        </p>
      </div>
    </div>
  </Link>
);

export default ConsultationBanner;
